package giving

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"image"
	_ "image/jpeg"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db     *pgxpool.Pool
	client *http.Client
}

type STKPushRequest struct {
	Category string `json:"category"`
	Phone    string `json:"phone"`
	Amount   int    `json:"amount"`
	Note     string `json:"note"`
}

type CardCheckoutRequest struct {
	Category string `json:"category"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Amount   int    `json:"amount"`
	Note     string `json:"note"`
}

type mpesaTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   string `json:"expires_in"`
}

type stkPushPayload struct {
	BusinessShortCode string `json:"BusinessShortCode"`
	Password          string `json:"Password"`
	Timestamp         string `json:"Timestamp"`
	TransactionType   string `json:"TransactionType"`
	Amount            int    `json:"Amount"`
	PartyA            string `json:"PartyA"`
	PartyB            string `json:"PartyB"`
	PhoneNumber       string `json:"PhoneNumber"`
	CallBackURL       string `json:"CallBackURL"`
	AccountReference  string `json:"AccountReference"`
	TransactionDesc   string `json:"TransactionDesc"`
}

type stkPushResponse struct {
	MerchantRequestID   string `json:"MerchantRequestID"`
	CheckoutRequestID   string `json:"CheckoutRequestID"`
	ResponseCode        string `json:"ResponseCode"`
	ResponseDescription string `json:"ResponseDescription"`
	CustomerMessage     string `json:"CustomerMessage"`
	ErrorCode           string `json:"errorCode"`
	ErrorMessage        string `json:"errorMessage"`
}

type givingErrorResponse struct {
	Message     string `json:"message"`
	Retryable   bool   `json:"retryable,omitempty"`
	Transaction gin.H  `json:"transaction,omitempty"`
}

var phonePattern = regexp.MustCompile(`^(?:\+254|254|0)?[17]\d{8}$`)

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{
		db: db,
		client: &http.Client{
			Timeout: 25 * time.Second,
		},
	}
}

func env(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func mpesaBaseURL() string {
	if strings.EqualFold(env("MPESA_ENV"), "production") || strings.EqualFold(env("MPESA_ENV"), "live") {
		return "https://api.safaricom.co.ke"
	}

	return "https://sandbox.safaricom.co.ke"
}

func newID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func normalizePhone(phone string) (string, bool) {
	cleaned := strings.ReplaceAll(strings.TrimSpace(phone), " ", "")
	cleaned = strings.ReplaceAll(cleaned, "-", "")

	if !phonePattern.MatchString(cleaned) {
		return "", false
	}

	if strings.HasPrefix(cleaned, "+254") {
		return strings.TrimPrefix(cleaned, "+"), true
	}

	if strings.HasPrefix(cleaned, "254") {
		return cleaned, true
	}

	if strings.HasPrefix(cleaned, "0") {
		return "254" + strings.TrimPrefix(cleaned, "0"), true
	}

	return cleaned, true
}

func category(value string) string {
	cleaned := strings.TrimSpace(value)
	if cleaned == "" {
		return "Offering"
	}

	return cleaned
}

func emailValid(value string) bool {
	value = strings.TrimSpace(strings.ToLower(value))
	return strings.Contains(value, "@") && strings.Contains(value, ".")
}

func (h Handler) STKPush(c *gin.Context) {
	var req STKPushRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid giving payload"})
		return
	}

	phone, ok := normalizePhone(req.Phone)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid Kenyan M-Pesa phone number is required"})
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Amount must be greater than zero"})
		return
	}

	if req.Amount > 250000 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Amount exceeds supported M-Pesa limit"})
		return
	}

	configError := validateMpesaConfig()
	if configError != "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": configError})
		return
	}

	txID := newID("give")

	_, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO giving_transactions (
				id,
				category,
				method,
				phone,
				amount,
				note,
				status
			)
			VALUES ($1, $2, 'mpesa', $3, $4, $5, 'pending')
		`,
		txID,
		category(req.Category),
		phone,
		req.Amount,
		strings.TrimSpace(req.Note),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create giving transaction"})
		return
	}

	token, err := h.accessToken(c.Request.Context())
	if err != nil {
		_ = h.markTransactionFailed(c.Request.Context(), txID, err.Error())
		c.JSON(http.StatusBadGateway, gin.H{"message": err.Error()})
		return
	}

	stkResponse, rawResponse, err := h.sendSTKPush(c.Request.Context(), token, txID, phone, req.Amount, category(req.Category))
	if err != nil {
		description := humanizeMpesaError(err.Error())
		_ = h.markTransactionFailed(c.Request.Context(), txID, description)

		transaction, ok, loadErr := h.getTransaction(c.Request.Context(), txID)
		if loadErr != nil {
			c.JSON(http.StatusBadGateway, givingErrorResponse{Message: description, Retryable: isRetryableMpesaError(err.Error())})
			return
		}
		if !ok {
			c.JSON(http.StatusBadGateway, givingErrorResponse{Message: description, Retryable: isRetryableMpesaError(err.Error())})
			return
		}

		c.JSON(http.StatusBadGateway, givingErrorResponse{
			Message:     description,
			Retryable:   isRetryableMpesaError(err.Error()),
			Transaction: transaction,
		})
		return
	}

	status := "pending"
	if stkResponse.ResponseCode != "" && stkResponse.ResponseCode != "0" {
		status = "failed"
	}

	_, err = h.db.Exec(
		c.Request.Context(),
		`
			UPDATE giving_transactions
			SET checkout_request_id = $2,
			    merchant_request_id = $3,
			    status = $4,
			    result_description = $5,
			    provider_response = $6::jsonb,
			    updated_at = NOW()
			WHERE id = $1
		`,
		txID,
		stkResponse.CheckoutRequestID,
		stkResponse.MerchantRequestID,
		status,
		firstNonEmpty(stkResponse.CustomerMessage, stkResponse.ResponseDescription, stkResponse.ErrorMessage),
		string(rawResponse),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update giving transaction"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"transaction": gin.H{
			"id":                txID,
			"category":          category(req.Category),
			"method":            "mpesa",
			"phone":             phone,
			"amount":            req.Amount,
			"status":            status,
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"merchantRequestId": stkResponse.MerchantRequestID,
			"message":           firstNonEmpty(stkResponse.CustomerMessage, stkResponse.ResponseDescription, stkResponse.ErrorMessage),
		},
	})
}

func flutterwaveBaseURL() string {
	return firstNonEmpty(env("FLUTTERWAVE_BASE_URL"), "https://developersandbox-api.flutterwave.com")
}

func (h Handler) CardCheckout(c *gin.Context) {
	var req CardCheckoutRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid card giving payload"})
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Amount must be greater than zero"})
		return
	}

	if req.Amount > 1000000 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Amount exceeds supported card payment limit"})
		return
	}

	if !emailValid(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "A valid email address is required"})
		return
	}

	txID := newID("card")
	currency := firstNonEmpty(strings.TrimSpace(env("GIVING_CURRENCY")), "KES")

	_, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO giving_transactions (
				id,
				category,
				method,
				phone,
				email,
				amount,
				note,
				status,
				currency,
				provider
			)
			VALUES ($1, $2, 'card', $3, $4, $5, $6, 'pending', $7, 'flutterwave')
		`,
		txID,
		category(req.Category),
		strings.TrimSpace(req.Phone),
		strings.TrimSpace(strings.ToLower(req.Email)),
		req.Amount,
		strings.TrimSpace(req.Note),
		currency,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create card giving transaction"})
		return
	}

	checkoutURL := ""
	providerReference := txID
	status := "pending"

	if strings.TrimSpace(env("FLUTTERWAVE_SECRET_KEY")) == "" {
		checkoutURL = strings.TrimRight(baseURLFromRequest(c), "/") + "/api/v1/giving/card/mock-checkout/" + txID
	} else {
		checkoutURL, providerReference, err = h.createFlutterwaveCheckout(c.Request.Context(), txID, req, currency)
		if err != nil {
			_ = h.markTransactionFailed(c.Request.Context(), txID, err.Error())
			c.JSON(http.StatusBadGateway, gin.H{"message": err.Error()})
			return
		}
	}

	_, err = h.db.Exec(
		c.Request.Context(),
		`
			UPDATE giving_transactions
			SET checkout_url = $2,
			    provider_reference = $3,
			    status = $4,
			    updated_at = NOW()
			WHERE id = $1
		`,
		txID,
		checkoutURL,
		providerReference,
		status,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update card giving transaction"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"transaction": gin.H{
			"id":          txID,
			"category":    category(req.Category),
			"method":      "card",
			"amount":      req.Amount,
			"email":       strings.TrimSpace(strings.ToLower(req.Email)),
			"status":      status,
			"currency":    currency,
			"checkoutUrl": checkoutURL,
			"provider":    "flutterwave",
			"reference":   providerReference,
			"message":     "Open the secure checkout page to finish the card payment.",
		},
	})
}

func baseURLFromRequest(c *gin.Context) string {
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwarded != "" {
		scheme = forwarded
	}
	return scheme + "://" + c.Request.Host
}

func (h Handler) createFlutterwaveCheckout(ctx context.Context, txID string, req CardCheckoutRequest, currency string) (string, string, error) {
	payload := map[string]any{
		"tx_ref":          txID,
		"amount":          req.Amount,
		"currency":        currency,
		"redirect_url":    firstNonEmpty(env("FLUTTERWAVE_REDIRECT_URL"), "https://example.com/giving/flutterwave/return"),
		"payment_options": "card",
		"customer": map[string]any{
			"email":       strings.TrimSpace(strings.ToLower(req.Email)),
			"name":        strings.TrimSpace(req.Name),
			"phonenumber": strings.TrimSpace(req.Phone),
		},
		"customizations": map[string]any{
			"title":       "Shekinah Sons Global Giving",
			"description": category(req.Category),
		},
		"meta": map[string]any{
			"category": category(req.Category),
			"note":     strings.TrimSpace(req.Note),
			"method":   "card",
		},
	}

	body, _ := json.Marshal(payload)
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(flutterwaveBaseURL(), "/")+"/payments",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", "", err
	}

	request.Header.Set("Authorization", "Bearer "+env("FLUTTERWAVE_SECRET_KEY"))
	request.Header.Set("Content-Type", "application/json")

	response, err := h.client.Do(request)
	if err != nil {
		return "", "", err
	}
	defer response.Body.Close()

	var payloadResponse struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Data    struct {
			Link string `json:"link"`
		} `json:"data"`
	}

	if err := json.NewDecoder(response.Body).Decode(&payloadResponse); err != nil {
		return "", "", err
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 || strings.TrimSpace(payloadResponse.Data.Link) == "" {
		return "", "", fmt.Errorf("%s", firstNonEmpty(payloadResponse.Message, "Failed to initialize card checkout"))
	}

	return strings.TrimSpace(payloadResponse.Data.Link), txID, nil
}

func validateMpesaConfig() string {
	required := map[string]string{
		"MPESA_CONSUMER_KEY":    env("MPESA_CONSUMER_KEY"),
		"MPESA_CONSUMER_SECRET": env("MPESA_CONSUMER_SECRET"),
		"MPESA_SHORTCODE":       env("MPESA_SHORTCODE"),
		"MPESA_PASSKEY":         env("MPESA_PASSKEY"),
		"MPESA_CALLBACK_URL":    env("MPESA_CALLBACK_URL"),
	}

	for key, value := range required {
		if value == "" {
			return key + " is not configured"
		}
	}

	return ""
}

func (h Handler) accessToken(ctx context.Context) (string, error) {
	log.Printf(
		"mpesa oauth start env=%s base=%s key=%s secret=%s shortcode=%s callback=%s",
		env("MPESA_ENV"),
		mpesaBaseURL(),
		secretFingerprint(env("MPESA_CONSUMER_KEY")),
		secretFingerprint(env("MPESA_CONSUMER_SECRET")),
		secretFingerprint(env("MPESA_SHORTCODE")),
		strings.TrimSpace(env("MPESA_CALLBACK_URL")),
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		mpesaBaseURL()+"/oauth/v1/generate?grant_type=client_credentials",
		nil,
	)
	if err != nil {
		return "", err
	}

	auth := base64.StdEncoding.EncodeToString([]byte(env("MPESA_CONSUMER_KEY") + ":" + env("MPESA_CONSUMER_SECRET")))
	req.Header.Set("Authorization", "Basic "+auth)

	resp, err := h.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var payload mpesaTokenResponse
	if len(body) > 0 {
		if err := json.Unmarshal(body, &payload); err != nil {
			return "", fmt.Errorf("mpesa token response parse failed: %w", err)
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 || payload.AccessToken == "" {
		log.Printf("mpesa oauth failed status=%d body=%s", resp.StatusCode, sanitizeMpesaErrorBody(body))
		return "", fmt.Errorf("mpesa token request failed: status=%d body=%s", resp.StatusCode, sanitizeMpesaErrorBody(body))
	}

	log.Printf("mpesa oauth success expires_in=%s", payload.ExpiresIn)

	return payload.AccessToken, nil
}

func sanitizeMpesaErrorBody(body []byte) string {
	text := strings.TrimSpace(string(body))
	if text == "" {
		return "<empty>"
	}

	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.ReplaceAll(text, "\r", " ")
	if len(text) > 280 {
		return text[:280] + "..."
	}

	return text
}

func isRetryableMpesaError(message string) bool {
	message = strings.ToLower(strings.TrimSpace(message))
	return strings.Contains(message, "500.003.02") || strings.Contains(message, "system is busy")
}

func humanizeMpesaError(message string) string {
	if isRetryableMpesaError(message) {
		return "M-Pesa is temporarily busy. Retry in a few minutes."
	}

	if strings.Contains(strings.ToLower(message), "wrong credentials") {
		return "M-Pesa credentials are not configured correctly for STK Push."
	}

	return strings.TrimSpace(message)
}

func secretFingerprint(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "<empty>"
	}

	sum := sha256.Sum256([]byte(value))
	fingerprint := hex.EncodeToString(sum[:])
	if len(fingerprint) > 12 {
		fingerprint = fingerprint[:12]
	}

	return fmt.Sprintf("len=%d tail=%s sha=%s", len(value), tail(value, 4), fingerprint)
}

func tail(value string, size int) string {
	if len(value) <= size {
		return value
	}
	return value[len(value)-size:]
}

func (h Handler) sendSTKPush(ctx context.Context, token string, txID string, phone string, amount int, givingCategory string) (stkPushResponse, []byte, error) {
	timestamp := time.Now().Format("20060102150405")
	shortcode := env("MPESA_SHORTCODE")
	password := base64.StdEncoding.EncodeToString([]byte(shortcode + env("MPESA_PASSKEY") + timestamp))
	transactionType := firstNonEmpty(env("MPESA_TRANSACTION_TYPE"), "CustomerPayBillOnline")

	log.Printf(
		"mpesa stk start tx=%s phone=%s amount=%d type=%s shortcode=%s passkey=%s callback=%s",
		txID,
		phone,
		amount,
		transactionType,
		secretFingerprint(shortcode),
		secretFingerprint(env("MPESA_PASSKEY")),
		strings.TrimSpace(env("MPESA_CALLBACK_URL")),
	)

	payload := stkPushPayload{
		BusinessShortCode: shortcode,
		Password:          password,
		Timestamp:         timestamp,
		TransactionType:   transactionType,
		Amount:            amount,
		PartyA:            phone,
		PartyB:            shortcode,
		PhoneNumber:       phone,
		CallBackURL:       env("MPESA_CALLBACK_URL"),
		AccountReference:  firstNonEmpty(env("MPESA_ACCOUNT_REFERENCE"), "Shekinah"),
		TransactionDesc:   fmt.Sprintf("%s - %s", givingCategory, txID),
	}

	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		mpesaBaseURL()+"/mpesa/stkpush/v1/processrequest",
		bytes.NewReader(body),
	)
	if err != nil {
		return stkPushResponse{}, nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.client.Do(req)
	if err != nil {
		return stkPushResponse{}, nil, err
	}
	defer resp.Body.Close()

	var result stkPushResponse
	var raw map[string]any

	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return stkPushResponse{}, nil, err
	}

	rawBytes, _ := json.Marshal(raw)
	_ = json.Unmarshal(rawBytes, &result)

	log.Printf(
		"mpesa stk response status=%d body=%s code=%s error_code=%s",
		resp.StatusCode,
		sanitizeMpesaErrorBody(rawBytes),
		result.ResponseCode,
		result.ErrorCode,
	)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return result, rawBytes, fmt.Errorf("%s", firstNonEmpty(result.ErrorMessage, result.ResponseDescription, "M-Pesa STK push failed"))
	}

	if result.ResponseCode != "" && result.ResponseCode != "0" {
		return result, rawBytes, fmt.Errorf("%s", firstNonEmpty(result.ErrorMessage, result.ResponseDescription, "M-Pesa STK push rejected"))
	}

	return result, rawBytes, nil
}

func (h Handler) Callback(c *gin.Context) {
	var payload map[string]any

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ResultCode": 1, "ResultDesc": "Invalid payload"})
		return
	}

	callback := mapValue(mapValue(mapValue(payload, "Body"), "stkCallback"), "")
	checkoutRequestID := stringValue(callback["CheckoutRequestID"])
	merchantRequestID := stringValue(callback["MerchantRequestID"])
	resultCode := intValue(callback["ResultCode"])
	resultDescription := stringValue(callback["ResultDesc"])
	receipt := callbackReceipt(callback)

	status := "failed"
	if resultCode == 0 {
		status = "success"
	}

	rawBytes, _ := json.Marshal(payload)

	_, err := h.db.Exec(
		c.Request.Context(),
		`
			UPDATE giving_transactions
			SET status = $2,
			    merchant_request_id = COALESCE(NULLIF($3, ''), merchant_request_id),
			    mpesa_receipt_number = $4,
			    result_code = $5,
			    result_description = $6,
			    provider_response = $7::jsonb,
			    updated_at = NOW()
			WHERE checkout_request_id = $1
		`,
		checkoutRequestID,
		status,
		merchantRequestID,
		receipt,
		resultCode,
		resultDescription,
		string(rawBytes),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ResultCode": 1, "ResultDesc": "Callback update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ResultCode": 0, "ResultDesc": "Accepted"})
}

func (h Handler) CardReturn(c *gin.Context) {
	txRef := strings.TrimSpace(c.Query("tx_ref"))
	status := strings.TrimSpace(strings.ToLower(c.Query("status")))
	transactionID := strings.TrimSpace(c.Query("transaction_id"))

	if txRef != "" {
		nextStatus := "pending"
		description := "Waiting for card provider confirmation."

		switch status {
		case "successful", "completed":
			nextStatus = "success"
			description = "Card payment reported as successful."
		case "failed", "cancelled":
			nextStatus = status
			description = "Card payment did not complete."
		}

		_, _ = h.db.Exec(
			c.Request.Context(),
			`
				UPDATE giving_transactions
				SET status = $2,
				    provider_reference = COALESCE(NULLIF($3, ''), provider_reference),
				    result_description = $4,
				    updated_at = NOW()
				WHERE id = $1
			`,
			txRef,
			nextStatus,
			transactionID,
			description,
		)
	}

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, "<html><body style='background:#000;color:#fff;font-family:sans-serif;padding:32px;'><h2>Payment received</h2><p>You can return to the Shekinah app and refresh Giving History.</p></body></html>")
}

func (h Handler) MockCheckoutPage(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.String(http.StatusBadRequest, "Missing transaction id")
		return
	}

	c.Header("Content-Type", "text/html; charset=utf-8")
	page := `
	<html>
		<body style="background:#000;color:#fff;font-family:sans-serif;padding:32px;">
			<h2>Flutterwave Sandbox Mock</h2>
			<p>This local page simulates a hosted card checkout for transaction {{.ID}}.</p>
			<p><a style="color:#d4af37" href="/api/v1/giving/card/mock-complete/{{.ID}}">Mark Payment Successful</a></p>
		</body>
	</html>`

	_ = template.Must(template.New("mock").Parse(page)).Execute(c.Writer, gin.H{"ID": id})
}

func (h Handler) MockComplete(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.String(http.StatusBadRequest, "Missing transaction id")
		return
	}

	_, _ = h.db.Exec(
		c.Request.Context(),
		`
			UPDATE giving_transactions
			SET status = 'success',
			    provider_reference = COALESCE(NULLIF(provider_reference, ''), id),
			    result_description = 'Sandbox mock payment completed.',
			    updated_at = NOW()
			WHERE id = $1
		`,
		id,
	)

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, "<html><body style='background:#000;color:#fff;font-family:sans-serif;padding:32px;'><h2>Payment marked successful</h2><p>Return to the Shekinah app and refresh Giving History.</p></body></html>")
}

func (h Handler) GetTransaction(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))

	transaction, ok, err := h.getTransaction(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load transaction"})
		return
	}

	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Transaction not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transaction": transaction})
}

func (h Handler) DownloadReceipt(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	transaction, ok, err := h.getTransaction(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load transaction"})
		return
	}
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Transaction not found"})
		return
	}
	if strings.TrimSpace(stringValue(transaction["status"])) != "success" {
		c.JSON(http.StatusConflict, gin.H{"message": "Receipt is available only for completed payments"})
		return
	}

	filename := "shekinah-receipt-" + strings.TrimSpace(stringValue(transaction["id"])) + ".pdf"
	h.serveDocumentPDF(c, filename, "Giving Receipt", "Official receipt for a completed giving transaction.", transaction)
}

func (h Handler) DownloadInvoice(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	transaction, ok, err := h.getTransaction(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load transaction"})
		return
	}
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Transaction not found"})
		return
	}

	filename := "shekinah-invoice-" + strings.TrimSpace(stringValue(transaction["id"])) + ".pdf"
	h.serveDocumentPDF(c, filename, "Giving Invoice", "Transaction summary generated from the giving system.", transaction)
}

func (h Handler) ListTransactions(c *gin.Context) {
	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT id, category, method, phone, amount, note, status,
			       checkout_request_id, merchant_request_id, mpesa_receipt_number,
			       COALESCE(result_code, -1), result_description, created_at, updated_at,
			       email, currency, provider, checkout_url, provider_reference
			FROM giving_transactions
			ORDER BY created_at DESC
			LIMIT 200
		`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load giving transactions"})
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0)

	for rows.Next() {
		item, err := scanTransaction(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to scan giving transaction"})
			return
		}

		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"transactions": items})
}

func (h Handler) serveDocumentPDF(c *gin.Context, filename string, title string, subtitle string, transaction gin.H) {
	pdf, err := buildGivingDocumentPDF(title, subtitle, transaction)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate document"})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/pdf", pdf)
}

type scanner interface {
	Scan(dest ...any) error
}

func (h Handler) getTransaction(ctx context.Context, id string) (gin.H, bool, error) {
	row := h.db.QueryRow(
		ctx,
		`
			SELECT id, category, method, phone, amount, note, status,
			       checkout_request_id, merchant_request_id, mpesa_receipt_number,
			       COALESCE(result_code, -1), result_description, created_at, updated_at,
			       email, currency, provider, checkout_url, provider_reference
			FROM giving_transactions
			WHERE id = $1
			LIMIT 1
		`,
		id,
	)

	item, err := scanTransaction(row)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, false, nil
		}

		return nil, false, err
	}

	return item, true, nil
}

func scanTransaction(row scanner) (gin.H, error) {
	var (
		id                string
		category          string
		method            string
		phone             string
		amount            int
		note              string
		status            string
		checkoutRequestID string
		merchantRequestID string
		receipt           string
		resultCode        int
		resultDescription string
		createdAt         time.Time
		updatedAt         time.Time
		email             string
		currency          string
		provider          string
		checkoutURL       string
		providerReference string
	)

	err := row.Scan(
		&id,
		&category,
		&method,
		&phone,
		&amount,
		&note,
		&status,
		&checkoutRequestID,
		&merchantRequestID,
		&receipt,
		&resultCode,
		&resultDescription,
		&createdAt,
		&updatedAt,
		&email,
		&currency,
		&provider,
		&checkoutURL,
		&providerReference,
	)
	if err != nil {
		return nil, err
	}

	var resultCodeValue any = resultCode
	if resultCode < 0 {
		resultCodeValue = nil
	}

	return gin.H{
		"id":                 id,
		"category":           category,
		"method":             method,
		"phone":              phone,
		"amount":             amount,
		"note":               note,
		"status":             status,
		"checkoutRequestId":  checkoutRequestID,
		"merchantRequestId":  merchantRequestID,
		"mpesaReceiptNumber": receipt,
		"resultCode":         resultCodeValue,
		"resultDescription":  resultDescription,
		"createdAt":          createdAt,
		"updatedAt":          updatedAt,
		"email":              email,
		"currency":           currency,
		"provider":           provider,
		"checkoutUrl":        checkoutURL,
		"providerReference":  providerReference,
	}, nil
}

func buildGivingDocumentPDF(title string, subtitle string, transaction gin.H) ([]byte, error) {
	logoBytes, logoWidth, logoHeight := loadReceiptLogo()
	content := buildGivingDocumentContent(title, subtitle, transaction, len(logoBytes) > 0, logoWidth, logoHeight)

	pageResources := "<< /Font << /F1 5 0 R >>"
	if len(logoBytes) > 0 {
		pageResources += " /XObject << /Im1 6 0 R >>"
	}
	pageResources += " >>"

	objects := make([][]byte, 0, 6)
	objects = append(objects,
		[]byte("<< /Type /Catalog /Pages 2 0 R >>"),
		[]byte("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
		[]byte(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources %s /Contents 4 0 R >>", pageResources)),
		[]byte(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content)),
		[]byte("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
	)

	if len(logoBytes) > 0 {
		objects = append(objects, []byte(fmt.Sprintf(
			"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
			logoWidth,
			logoHeight,
			len(logoBytes),
			string(logoBytes),
		)))
	}

	return buildPDF(objects), nil
}

func buildPDF(objects [][]byte) []byte {
	var out bytes.Buffer
	out.WriteString("%PDF-1.4\n")

	offsets := make([]int, len(objects)+1)
	for index, object := range objects {
		offsets[index+1] = out.Len()
		out.WriteString(fmt.Sprintf("%d 0 obj\n", index+1))
		out.Write(object)
		out.WriteString("\nendobj\n")
	}

	xrefOffset := out.Len()
	out.WriteString(fmt.Sprintf("xref\n0 %d\n", len(objects)+1))
	out.WriteString("0000000000 65535 f \n")
	for index := 1; index <= len(objects); index++ {
		out.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[index]))
	}

	out.WriteString(fmt.Sprintf(
		"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF",
		len(objects)+1,
		xrefOffset,
	))

	return out.Bytes()
}

func buildGivingDocumentContent(title string, subtitle string, transaction gin.H, hasLogo bool, logoWidth int, logoHeight int) string {
	var content strings.Builder

	content.WriteString("0.05 0.07 0.14 rg\n0 738 595 104 re f\n")
	content.WriteString("0.82 0.69 0.22 rg\n0 732 595 6 re f\n")

	if hasLogo && logoWidth > 0 && logoHeight > 0 {
		drawWidth := 84.0
		drawHeight := drawWidth * float64(logoHeight) / float64(logoWidth)
		content.WriteString(fmt.Sprintf("q\n%.2f 0 0 %.2f 44 758 cm\n/Im1 Do\nQ\n", drawWidth, drawHeight))
	}

	writePDFText(&content, 150, 802, 22, [3]float64{1, 1, 1}, "Shekinah Sons Global")
	writePDFText(&content, 150, 776, 16, [3]float64{0.95, 0.89, 0.62}, title)
	writePDFText(&content, 150, 756, 10, [3]float64{0.80, 0.83, 0.90}, subtitle)

	content.WriteString("0.97 0.98 1 rg\n40 648 515 64 re f\n")
	content.WriteString("0.84 0.87 0.93 RG\n1 w\n40 648 515 64 re S\n")
	writePDFText(&content, 60, 689, 11, [3]float64{0.42, 0.47, 0.56}, "Amount")
	writePDFText(&content, 60, 665, 24, [3]float64{0.06, 0.09, 0.16}, formatKesDocument(transaction["amount"], stringValue(transaction["currency"])))
	writePDFText(&content, 360, 689, 11, [3]float64{0.42, 0.47, 0.56}, "Status")
	writePDFText(&content, 360, 665, 18, statusTextColor(stringValue(transaction["status"])), documentStatusLabel(stringValue(transaction["status"])))

	writePDFText(&content, 40, 620, 13, [3]float64{0.82, 0.69, 0.22}, "Transaction Details")

	details := [][2]string{
		{"Transaction ID", stringValue(transaction["id"])},
		{"Created", formatDocumentDate(transaction["createdAt"])},
		{"Category", stringValue(transaction["category"])},
		{"Method", strings.ToUpper(firstNonEmpty(stringValue(transaction["method"]), "mpesa"))},
		{"Phone", firstNonEmpty(stringValue(transaction["phone"]), "-")},
		{"Receipt Number", firstNonEmpty(stringValue(transaction["mpesaReceiptNumber"]), "-")},
		{"Checkout Request ID", firstNonEmpty(stringValue(transaction["checkoutRequestId"]), "-")},
		{"Merchant Request ID", firstNonEmpty(stringValue(transaction["merchantRequestId"]), "-")},
		{"Result", firstNonEmpty(stringValue(transaction["resultDescription"]), "-")},
	}

	if note := strings.TrimSpace(stringValue(transaction["note"])); note != "" {
		details = append(details, [2]string{"Note", note})
	}

	y := 592.0
	for _, detail := range details {
		content.WriteString("0.94 0.95 0.97 rg\n40 ")
		content.WriteString(fmt.Sprintf("%.2f 515 28 re f\n", y-18))
		writePDFText(&content, 52, y, 10, [3]float64{0.42, 0.47, 0.56}, detail[0])
		writePDFText(&content, 195, y, 11, [3]float64{0.08, 0.11, 0.18}, detail[1])
		y -= 34
	}

	writePDFText(&content, 40, 72, 10, [3]float64{0.42, 0.47, 0.56}, "Generated by the Shekinah Sons Global giving system.")
	return content.String()
}

func escapePDFText(value string) string {
	replacer := strings.NewReplacer("\\", "\\\\", "(", "\\(", ")", "\\)")
	return replacer.Replace(value)
}

func writePDFText(builder *strings.Builder, x float64, y float64, fontSize int, color [3]float64, value string) {
	builder.WriteString("BT\n")
	builder.WriteString(fmt.Sprintf("%.2f %.2f %.2f rg\n", color[0], color[1], color[2]))
	builder.WriteString(fmt.Sprintf("/F1 %d Tf\n", fontSize))
	builder.WriteString(fmt.Sprintf("1 0 0 1 %.2f %.2f Tm\n", x, y))
	builder.WriteString(fmt.Sprintf("(%s) Tj\n", escapePDFText(value)))
	builder.WriteString("ET\n")
}

func statusTextColor(status string) [3]float64 {
	switch strings.TrimSpace(strings.ToLower(status)) {
	case "success":
		return [3]float64{0.16, 0.58, 0.30}
	case "failed", "cancelled":
		return [3]float64{0.82, 0.23, 0.23}
	default:
		return [3]float64{0.82, 0.69, 0.22}
	}
}

func loadReceiptLogo() ([]byte, int, int) {
	candidates := []string{
		"../phase1_app/assets/branding/shekinah-logo.jpeg",
		"./phase1_app/assets/branding/shekinah-logo.jpeg",
	}

	for _, candidate := range candidates {
		data, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}

		cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			continue
		}

		return data, cfg.Width, cfg.Height
	}

	return nil, 0, 0
}

func formatKesDocument(amount any, currency string) string {
	value := intValue(amount)
	code := firstNonEmpty(currency, "KES")
	return fmt.Sprintf("%s %s", code, strconv.Itoa(value))
}

func formatDocumentDate(value any) string {
	switch typed := value.(type) {
	case time.Time:
		return typed.Format("2006-01-02 15:04:05 MST")
	case string:
		return typed
	default:
		return ""
	}
}

func documentStatusLabel(status string) string {
	switch strings.TrimSpace(strings.ToLower(status)) {
	case "success":
		return "Paid"
	case "failed":
		return "Failed"
	case "cancelled":
		return "Cancelled"
	default:
		return "Pending"
	}
}

func (h Handler) markTransactionFailed(ctx context.Context, id string, description string) error {
	_, err := h.db.Exec(
		ctx,
		`
			UPDATE giving_transactions
			SET status = 'failed',
			    result_description = $2,
			    updated_at = NOW()
			WHERE id = $1
		`,
		id,
		description,
	)

	return err
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}

	return ""
}

func mapValue(value any, key string) map[string]any {
	if key == "" {
		if mapped, ok := value.(map[string]any); ok {
			return mapped
		}

		return map[string]any{}
	}

	parent, ok := value.(map[string]any)
	if !ok {
		return map[string]any{}
	}

	child, ok := parent[key].(map[string]any)
	if !ok {
		return map[string]any{}
	}

	return child
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int:
		return strconv.Itoa(typed)
	default:
		return ""
	}
}

func intValue(value any) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case string:
		value, _ := strconv.Atoi(typed)
		return value
	default:
		return -1
	}
}

func callbackReceipt(callback map[string]any) string {
	metadata := mapValue(callback, "CallbackMetadata")
	items, ok := metadata["Item"].([]any)
	if !ok {
		return ""
	}

	for _, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}

		if subtle.ConstantTimeCompare([]byte(stringValue(item["Name"])), []byte("MpesaReceiptNumber")) == 1 {
			return stringValue(item["Value"])
		}
	}

	return ""
}
