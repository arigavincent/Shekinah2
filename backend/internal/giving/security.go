package giving

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/gin-gonic/gin"
)

// A guest receives a capability only when creating their own confirmation.
// Transaction IDs themselves never grant access to personal/payment data.
func (h Handler) receiptToken(id string) string {
	if h.secret == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(h.secret))
	_, _ = mac.Write([]byte("receipt:" + id))
	return hex.EncodeToString(mac.Sum(nil))
}

func (h Handler) authorizeTransaction(c *gin.Context, id string) bool {
	var owner string
	if err := h.db.QueryRow(c.Request.Context(), `SELECT COALESCE(user_id::text, '') FROM giving_transactions WHERE id=$1`, id).Scan(&owner); err != nil {
		c.JSON(404, gin.H{"message": "Transaction not found"})
		return false
	}
	user, signedIn := auth.UserIDFromContext(c)
	if signedIn {
		var active, staff bool
		_ = h.db.QueryRow(c.Request.Context(), `SELECT is_active, (role IN ('admin','super_admin') OR 'finance:manage'=ANY(permissions || COALESCE((SELECT r.permissions FROM staff_roles r WHERE r.id=users.staff_role_id),'{}'::text[]))) AND NOT password_reset_required FROM users WHERE id=$1`, user).Scan(&active, &staff)
		if active && (owner == user || staff) {
			return true
		}
	}
	provided, expected := c.GetHeader("X-Receipt-Token"), h.receiptToken(id)
	if owner == "" && provided != "" && expected != "" && hmac.Equal([]byte(provided), []byte(expected)) {
		return true
	}
	status := http.StatusUnauthorized
	if signedIn {
		status = http.StatusForbidden
	}
	c.JSON(status, gin.H{"message": "Sign in as the payer or use the receipt saved on the device that submitted this payment."})
	return false
}

// Redirect parameters are untrusted. Only Flutterwave's authenticated
// verification response can settle a card payment, and only the expected
// reference, amount, currency and provider may match.
func (h Handler) CardReturn(c *gin.Context) {
	var ready bool
	h, ready = h.operational(c, "flutterwave", false)
	if !ready {
		return
	}
	key := h.env("FLUTTERWAVE_SECRET_KEY")
	if key == "" {
		c.JSON(503, gin.H{"message": "Card verification is not configured. Use the manual payment methods."})
		return
	}
	id, providerID := strings.TrimSpace(c.Query("tx_ref")), strings.TrimSpace(c.Query("transaction_id"))
	var amount int
	var currency string
	if id == "" || providerID == "" {
		c.JSON(400, gin.H{"message": "Missing payment reference"})
		return
	}
	if err := h.db.QueryRow(c.Request.Context(), `SELECT amount,currency FROM giving_transactions WHERE id=$1 AND provider='flutterwave' AND method='card'`, id).Scan(&amount, &currency); err != nil {
		c.JSON(404, gin.H{"message": "Card payment not found"})
		return
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), "GET", strings.TrimRight(h.flutterwaveBaseURL(), "/")+"/transactions/"+url.PathEscape(providerID)+"/verify", nil)
	if err != nil {
		c.JSON(502, gin.H{"message": "Unable to verify payment"})
		return
	}
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := h.client.Do(req)
	if err != nil {
		c.JSON(502, gin.H{"message": "Unable to reach payment provider. Your payment remains pending."})
		return
	}
	defer resp.Body.Close()
	var result struct {
		Status string `json:"status"`
		Data   struct {
			Reference string  `json:"tx_ref"`
			Status    string  `json:"status"`
			Currency  string  `json:"currency"`
			Amount    float64 `json:"amount"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || resp.StatusCode != 200 || result.Status != "success" || result.Data.Status != "successful" || result.Data.Reference != id || result.Data.Currency != currency || result.Data.Amount < float64(amount) {
		c.JSON(409, gin.H{"message": "Payment has not been verified. Check your giving history or contact finance."})
		return
	}
	if _, err := h.db.Exec(c.Request.Context(), `UPDATE giving_transactions SET status='success',provider_reference=$2,result_description='Verified with payment provider',updated_at=NOW() WHERE id=$1 AND provider='flutterwave' AND status IN ('pending','success')`, id, providerID); err != nil {
		c.JSON(500, gin.H{"message": "Could not save verified payment"})
		return
	}
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(200, "<html><body><h2>Payment verified</h2><p>Return to the Shekinah app to view your receipt.</p></body></html>")
}

func (h Handler) callbackURL(intent ...string) string {
	u, err := url.Parse(h.env("MPESA_CALLBACK_URL"))
	if err != nil {
		return ""
	}
	q := u.Query()
	q.Set("token", h.env("MPESA_CALLBACK_TOKEN"))
	if len(intent) > 0 {
		q.Set("intent", intent[0])
	}
	u.RawQuery = q.Encode()
	return u.String()
}
