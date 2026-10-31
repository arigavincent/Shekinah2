package giving

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"github.com/ariga/shekinah-backend/internal/auth"
)

// Giving by M-Pesa paybill, Airtel Money paybill or bank transfer. The
// member pays from their own phone or bank, then confirms in the app with
// the transaction code; the finance team verifies it in the dashboard.

const detailsKey = "giving_details"

type PaybillDetails struct {
	Enabled     bool   `json:"enabled"`
	Paybill     string `json:"paybill"`
	Account     string `json:"account"`
	AccountHint string `json:"accountHint"`
	Name        string `json:"name"`
}

type BankDetails struct {
	Enabled       bool   `json:"enabled"`
	BankName      string `json:"bankName"`
	AccountName   string `json:"accountName"`
	AccountNumber string `json:"accountNumber"`
	Branch        string `json:"branch"`
	SwiftCode     string `json:"swiftCode"`
	Reference     string `json:"reference"`
}

type GivingDetails struct {
	MpesaPrompt bool           `json:"mpesaPrompt"`
	Cards       bool           `json:"cards"`
	Mpesa       PaybillDetails `json:"mpesa"`
	Airtel      PaybillDetails `json:"airtel"`
	Bank        BankDetails    `json:"bank"`
	Note        string         `json:"note"`
	Categories  []string       `json:"categories"`
}

var defaultCategories = []string{"Tithe", "Offering", "Thanksgiving", "Project", "Special Seed"}

func (h Handler) loadDetails(c *gin.Context) (GivingDetails, error) {
	var raw string
	err := h.db.QueryRow(c.Request.Context(), `SELECT value FROM app_settings WHERE key = $1`, detailsKey).Scan(&raw)
	details := GivingDetails{Categories: defaultCategories}
	if errors.Is(err, pgx.ErrNoRows) || strings.TrimSpace(raw) == "" {
		return details, nil
	}
	if err != nil {
		return details, err
	}
	if err := json.Unmarshal([]byte(raw), &details); err != nil {
		return GivingDetails{Categories: defaultCategories}, nil
	}
	if len(details.Categories) == 0 {
		details.Categories = defaultCategories
	}
	return details, nil
}

// GET /giving/details: what the app shows on the payment cards.
func (h Handler) Details(c *gin.Context) {
	details, err := h.loadDetails(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load giving details"})
		return
	}
	details.MpesaPrompt = h.providerAvailable(c.Request.Context(), "mpesa")
	details.Cards = h.providerAvailable(c.Request.Context(), "flutterwave")
	c.JSON(http.StatusOK, gin.H{"details": details})
}

func clean(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) > max {
		value = value[:max]
	}
	return value
}

// PUT /admin/giving/details
func (h Handler) AdminUpdateDetails(c *gin.Context) {
	var req GivingDetails
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid giving details"})
		return
	}
	digits := regexp.MustCompile(`^\d{5,8}$`)
	for name, p := range map[string]*PaybillDetails{"M-Pesa": &req.Mpesa, "Airtel Money": &req.Airtel} {
		p.Paybill = clean(p.Paybill, 12)
		p.Account = clean(p.Account, 40)
		p.AccountHint = clean(p.AccountHint, 80)
		p.Name = clean(p.Name, 80)
		if p.Enabled && !digits.MatchString(p.Paybill) {
			c.JSON(http.StatusBadRequest, gin.H{"message": name + " paybill must be 5 to 8 digits"})
			return
		}
	}
	b := &req.Bank
	b.BankName, b.AccountName, b.AccountNumber = clean(b.BankName, 80), clean(b.AccountName, 80), clean(b.AccountNumber, 40)
	b.Branch, b.SwiftCode, b.Reference = clean(b.Branch, 80), clean(b.SwiftCode, 20), clean(b.Reference, 80)
	if b.Enabled && (b.BankName == "" || b.AccountNumber == "") {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Bank name and account number are required"})
		return
	}
	req.Note = clean(req.Note, 500)
	categories := make([]string, 0, len(req.Categories))
	for _, item := range req.Categories {
		if item = clean(item, 40); item != "" {
			categories = append(categories, item)
		}
	}
	if len(categories) == 0 {
		categories = defaultCategories
	}
	req.Categories = categories

	raw, _ := json.Marshal(req)
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, detailsKey, string(raw))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save giving details"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"details": req})
}

type ConfirmRequest struct {
	Method    string `json:"method"`
	Category  string `json:"category"`
	Amount    int    `json:"amount"`
	Reference string `json:"reference"`
	Phone     string `json:"phone"`
	Name      string `json:"name"`
	Note      string `json:"note"`
	// Buying a book from the library with this payment.
	ItemID string `json:"itemId"`
}

var referencePattern = regexp.MustCompile(`^[A-Z0-9]{6,20}$`)

// POST /giving/confirm: "I have paid", with the transaction code.
func (h Handler) Confirm(c *gin.Context) {
	var req ConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid payment confirmation"})
		return
	}
	method := strings.ToLower(strings.TrimSpace(req.Method))
	if method != "mpesa_paybill" && method != "airtel_paybill" && method != "bank" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Choose M-Pesa, Airtel Money or bank"})
		return
	}
	if req.ItemID == "" && (req.Amount <= 0 || req.Amount > 10_000_000) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Enter the amount you paid"})
		return
	}
	reference := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(req.Reference), " ", ""))
	if !referencePattern.MatchString(reference) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Enter the transaction code from your confirmation message (for example SJK4XY7Z2P)"})
		return
	}
	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		c.JSON(500, gin.H{"message": "Could not record payment"})
		return
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, method+":"+reference); err != nil {
		c.JSON(500, gin.H{"message": "Could not record payment"})
		return
	}
	category := clean(req.Category, 40)
	if category == "" {
		category = "Offering"
	}
	itemID := strings.TrimSpace(req.ItemID)
	note := clean(req.Note, 300)
	if itemID != "" {
		// A purchase (a book, an event ticket or a paid live): must be signed
		// in, and the amount is the item's price.
		buyer, ok := auth.UserIDFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Sign in to pay for this"})
			return
		}
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "purchase:"+buyer+":"+itemID); err != nil {
			c.JSON(500, gin.H{"message": "Could not record purchase"})
			return
		}
		title, price, kind, err := h.itemPrice(c.Request.Context(), itemID)
		if err != nil || price <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "This isn't for sale"})
			return
		}
		var already bool
		_ = tx.QueryRow(c.Request.Context(), `SELECT EXISTS (SELECT 1 FROM giving_transactions WHERE item_id = $1 AND user_id::text = $2 AND status IN ('success','awaiting_verification'))`, itemID, buyer).Scan(&already)
		if already {
			c.JSON(http.StatusConflict, gin.H{"message": "You've already paid for this (or your payment is being confirmed)."})
			return
		}
		req.Amount = price
		category = kind
		note = title
	}

	var exists bool
	_ = tx.QueryRow(c.Request.Context(), `SELECT EXISTS (SELECT 1 FROM giving_transactions WHERE method = $1 AND provider_reference = $2)`, method, reference).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"message": "This transaction code has already been submitted. Thank you!"})
		return
	}

	var userID any
	if id, ok := auth.UserIDFromContext(c); ok {
		userID = id
	}
	provider := map[string]string{"mpesa_paybill": "mpesa", "airtel_paybill": "airtel", "bank": "bank"}[method]
	id := "giv-" + strings.ToLower(strconvBase36(time.Now().UnixNano()))
	_, err = tx.Exec(c.Request.Context(), `
		INSERT INTO giving_transactions (id, category, method, phone, amount, note, status, provider, provider_reference, email, user_id, payer_name, item_id)
		VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_verification', $7, $8, '', $9, $10, $11)
	`, id, category, method, clean(req.Phone, 20), req.Amount, note, provider, reference, userID, clean(req.Name, 80), itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not record your confirmation. Please try again."})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(500, gin.H{"message": "Could not save payment"})
		return
	}
	transaction, _, _ := h.getTransaction(c.Request.Context(), id)
	if userID == nil {
		transaction["receiptToken"] = h.receiptToken(id)
	}
	c.JSON(http.StatusCreated, gin.H{"transaction": transaction})
}

// GET /giving/mine: the signed-in member's giving.
func (h Handler) Mine(c *gin.Context) {
	userID, _ := auth.UserIDFromContext(c)
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, category, method, phone, amount, note, status,
		       checkout_request_id, merchant_request_id, mpesa_receipt_number,
		       COALESCE(result_code, -1), result_description, created_at, updated_at,
		       email, currency, provider, checkout_url, provider_reference, payer_name
		FROM giving_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load your giving"})
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		item, err := scanTransaction(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load your giving"})
			return
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"transactions": items})
}

// PATCH /admin/giving/transactions/:id: finance confirms or rejects a payment.
func (h Handler) AdminReview(c *gin.Context) {
	var req struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.Status != "success" && req.Status != "failed") {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Status must be success or failed"})
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), `
		UPDATE giving_transactions SET status = $2, result_description = CASE WHEN $3 = '' THEN result_description ELSE $3 END, updated_at = NOW()
		WHERE id = $1 AND status IN ('awaiting_verification', 'pending', 'failed', 'success')
	`, c.Param("id"), req.Status, clean(req.Note, 200))
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Transaction not found"})
		return
	}
	transaction, _, _ := h.getTransaction(c.Request.Context(), c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"transaction": transaction})
}

func strconvBase36(v int64) string {
	const digits = "0123456789abcdefghijklmnopqrstuvwxyz"
	if v == 0 {
		return "0"
	}
	out := []byte{}
	for v > 0 {
		out = append([]byte{digits[v%36]}, out...)
		v /= 36
	}
	return string(out)
}

// itemPrice: what a purchase is for, by its id: a book, an event or a live.
func (h Handler) itemPrice(ctx context.Context, itemID string) (title string, price int, kind string, err error) {
	switch {
	case strings.HasPrefix(itemID, "evt-"):
		kind = "Event"
		err = h.db.QueryRow(ctx, `SELECT title, price FROM events WHERE id = $1 AND is_published AND published_at<=NOW()`, itemID).Scan(&title, &price)
	case strings.HasPrefix(itemID, "live-"):
		kind = "Live"
		err = h.db.QueryRow(ctx, `SELECT l.title, l.price FROM live_sessions l WHERE l.id = $1 AND (l.status IN ('starting','live') OR EXISTS(SELECT 1 FROM live_archives a WHERE a.session_id=l.id AND a.status='ready'))`, itemID).Scan(&title, &price)
	default:
		kind = "Book"
		err = h.db.QueryRow(ctx, `SELECT title, price FROM library_items WHERE id = $1 AND is_published AND published_at<=NOW()`, itemID).Scan(&title, &price)
	}
	return title, price, kind, err
}
