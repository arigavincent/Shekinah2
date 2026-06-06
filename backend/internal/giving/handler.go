package giving

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
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
		_ = h.markTransactionFailed(c.Request.Context(), txID, "Failed to authenticate with M-Pesa")
		c.JSON(http.StatusBadGateway, gin.H{"message": "Failed to authenticate with M-Pesa"})
		return
	}

	stkResponse, rawResponse, err := h.sendSTKPush(c.Request.Context(), token, txID, phone, req.Amount, category(req.Category))
	if err != nil {
		_ = h.markTransactionFailed(c.Request.Context(), txID, err.Error())
		c.JSON(http.StatusBadGateway, gin.H{"message": err.Error()})
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

	var payload mpesaTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 || payload.AccessToken == "" {
		return "", fmt.Errorf("mpesa token request failed")
	}

	return payload.AccessToken, nil
}

func (h Handler) sendSTKPush(ctx context.Context, token string, txID string, phone string, amount int, givingCategory string) (stkPushResponse, []byte, error) {
	timestamp := time.Now().Format("20060102150405")
	shortcode := env("MPESA_SHORTCODE")
	password := base64.StdEncoding.EncodeToString([]byte(shortcode + env("MPESA_PASSKEY") + timestamp))
	transactionType := firstNonEmpty(env("MPESA_TRANSACTION_TYPE"), "CustomerPayBillOnline")

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

func (h Handler) ListTransactions(c *gin.Context) {
	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT id, category, method, phone, amount, note, status,
			       checkout_request_id, merchant_request_id, mpesa_receipt_number,
			       COALESCE(result_code, -1), result_description, created_at, updated_at
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

type scanner interface {
	Scan(dest ...any) error
}

func (h Handler) getTransaction(ctx context.Context, id string) (gin.H, bool, error) {
	row := h.db.QueryRow(
		ctx,
		`
			SELECT id, category, method, phone, amount, note, status,
			       checkout_request_id, merchant_request_id, mpesa_receipt_number,
			       COALESCE(result_code, -1), result_description, created_at, updated_at
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
	}, nil
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
