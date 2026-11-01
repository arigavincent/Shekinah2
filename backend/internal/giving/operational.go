package giving

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/integrations"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"net/http"
	"regexp"
	"strings"
)

func (h Handler) WithProviderClient(client *http.Client) Handler {
	if client != nil {
		h.client = client
	}
	return h
}
func (h Handler) env(key string) string {
	if v, ok := h.values[key]; ok {
		return v
	}
	return env(key)
}
func (h Handler) operational(c *gin.Context, id string, requireEnabled bool) (Handler, bool) {
	cfg, _, e := (integrations.Store{DB: h.db, Secret: h.secret}).Load(c.Request.Context(), id)
	if e != nil {
		c.JSON(503, gin.H{"message": "Protected payment configuration is unavailable"})
		return h, false
	}
	if requireEnabled && !cfg.Enabled {
		c.JSON(503, gin.H{"message": "This payment method is not enabled. Use another available payment method."})
		return h, false
	}
	if requireEnabled {
		def, _ := integrations.DefinitionFor(id)
		if integrations.Validate(def, cfg) != nil {
			c.JSON(503, gin.H{"message": "Complete this payment method in Admin Settings before using it"})
			return h, false
		}
	}
	h.values = cfg.Values
	return h, true
}
func tokenHash(v string) string { sum := sha256.Sum256([]byte(v)); return hex.EncodeToString(sum[:]) }
func (h Handler) bindPurchase(c *gin.Context, itemID string, amount *int, kind, note *string) bool {
	if strings.TrimSpace(itemID) == "" {
		return true
	}
	buyer, _ := auth.UserIDFromContext(c)
	title, price, itemKind, e := h.itemPrice(c.Request.Context(), itemID, buyer)
	if e != nil || price <= 0 {
		c.JSON(400, gin.H{"message": "This item is not available for purchase"})
		return false
	}
	*amount = price
	*kind = itemKind
	*note = title
	return true
}

// Persist intent before contacting the provider. Repeated client requests return
// the same transaction and cannot launch a second prompt or checkout.
func (h Handler) automaticIntent(c *gin.Context, method, requestID, itemID, kind, note, phone, email, currency string, amount int) (string, bool, bool) {
	user, _ := auth.UserIDFromContext(c)
	if user == "" {
		c.JSON(401, gin.H{"message": "Sign in before paying"})
		return "", false, false
	}
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		c.JSON(400, gin.H{"message": "A unique payment request identifier is required"})
		return "", false, false
	}
	if requestID != "" && !regexp.MustCompile(`^[A-Za-z0-9_-]{8,80}$`).MatchString(requestID) {
		c.JSON(400, gin.H{"message": "Invalid payment request identifier"})
		return "", false, false
	}
	ctx := c.Request.Context()
	tx, e := h.db.Begin(ctx)
	if e != nil {
		c.JSON(503, gin.H{"message": "Could not prepare payment"})
		return "", false, false
	}
	defer tx.Rollback(ctx)
	lock := "payment:" + user + ":" + method + ":" + requestID
	if itemID != "" {
		lock = "purchase:" + user + ":" + itemID
	}
	if _, e = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, lock); e != nil {
		c.JSON(503, gin.H{"message": "Could not prepare payment"})
		return "", false, false
	}
	if requestID != "" {
		var id, oldItem, oldPhone, oldKind, oldCurrency string
		var oldAmount int
		e = tx.QueryRow(ctx, `SELECT id,item_id,amount,phone,category,currency FROM giving_transactions WHERE user_id::text=$1 AND method=$2 AND client_request_id=$3`, user, method, requestID).Scan(&id, &oldItem, &oldAmount, &oldPhone, &oldKind, &oldCurrency)
		if e == nil {
			if oldItem != itemID || oldAmount != amount || oldPhone != phone || oldKind != kind || oldCurrency != currency {
				c.JSON(409, gin.H{"message": "This request belongs to a different payment"})
				return "", false, false
			}
			if e = tx.Commit(ctx); e != nil {
				c.JSON(503, gin.H{"message": "Could not load payment"})
				return "", false, false
			}
			return id, true, true
		}
		if !errors.Is(e, pgx.ErrNoRows) {
			c.JSON(503, gin.H{"message": "Could not load payment"})
			return "", false, false
		}
	}
	if itemID != "" {
		var exists bool
		if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM giving_transactions WHERE user_id::text=$1 AND item_id=$2 AND status IN ('success','pending','awaiting_verification'))`, user, itemID).Scan(&exists); e != nil {
			c.JSON(503, gin.H{"message": "Could not check purchase"})
			return "", false, false
		}
		if exists {
			c.JSON(409, gin.H{"message": "This item has already been paid for or has a payment awaiting confirmation. Check your payment history first."})
			return "", false, false
		}
	}
	id := newID("give")
	provider := "mpesa"
	if method == "card" {
		id = newID("card")
		provider = "flutterwave"
	}
	hash := ""
	if method == "mpesa" {
		hash = tokenHash(h.env("MPESA_CALLBACK_TOKEN"))
	}
	_, e = tx.Exec(ctx, `INSERT INTO giving_transactions(id,user_id,method,provider,client_request_id,item_id,category,note,phone,email,currency,amount,status,callback_token_hash)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13)`, id, user, method, provider, requestID, itemID, kind, note, phone, email, currency, amount, hash)
	if e != nil {
		c.JSON(503, gin.H{"message": "Could not create payment"})
		return "", false, false
	}
	if e = tx.Commit(ctx); e != nil {
		c.JSON(503, gin.H{"message": "Could not save payment"})
		return "", false, false
	}
	return id, false, true
}
func (h Handler) existingPayment(c *gin.Context, id string) {
	transaction, ok, e := h.getTransaction(c.Request.Context(), id)
	if e != nil || !ok {
		c.JSON(503, gin.H{"message": "Could not load payment"})
		return
	}
	c.JSON(200, gin.H{"transaction": transaction})
}

// Captures configured keys once per payment request rather than mutating process environment.
func (h Handler) providerAvailable(ctx context.Context, id string) bool {
	cfg, _, e := (integrations.Store{DB: h.db, Secret: h.secret}).Load(ctx, id)
	def, _ := integrations.DefinitionFor(id)
	return e == nil && cfg.Enabled && integrations.Validate(def, cfg) == nil
}
