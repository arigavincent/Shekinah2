package auth

// Two-step sign-in with authenticator app codes (RFC 6238 TOTP: HMAC-SHA1,
// 30-second steps, 6 digits). Secrets are stored encrypted; each code works once.
import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

func totpAt(secret []byte, step int64) string {
	var counter [8]byte
	binary.BigEndian.PutUint64(counter[:], uint64(step))
	mac := hmac.New(sha1.New, secret)
	mac.Write(counter[:])
	sum := mac.Sum(nil)
	o := sum[len(sum)-1] & 0x0f
	code := (binary.BigEndian.Uint32(sum[o:o+4]) & 0x7fffffff) % 1_000_000
	return fmt.Sprintf("%06d", code)
}

// matchTOTP returns the step a code belongs to, allowing one step of clock drift.
func matchTOTP(secretB32, code string, now time.Time) (int64, bool) {
	secret, err := b32.DecodeString(strings.ToUpper(secretB32))
	code = strings.ReplaceAll(strings.TrimSpace(code), " ", "")
	if err != nil || len(code) != 6 {
		return 0, false
	}
	step := now.Unix() / 30
	for _, s := range []int64{step, step - 1, step + 1} {
		if hmac.Equal([]byte(totpAt(secret, s)), []byte(code)) {
			return s, true
		}
	}
	return 0, false
}

func (s Service) mfaCipher() cipher.AEAD {
	key := sha256.Sum256([]byte("shekinah-mfa:" + s.jwtSecret))
	block, _ := aes.NewCipher(key[:])
	aead, _ := cipher.NewGCM(block)
	return aead
}

func (s Service) seal(plain string) string {
	aead := s.mfaCipher()
	nonce := make([]byte, aead.NonceSize())
	_, _ = rand.Read(nonce)
	return base64.StdEncoding.EncodeToString(aead.Seal(nonce, nonce, []byte(plain), nil))
}

func (s Service) open(sealed string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(sealed)
	aead := s.mfaCipher()
	if err != nil || len(raw) < aead.NonceSize() {
		return "", errors.New("invalid secret")
	}
	plain, err := aead.Open(nil, raw[:aead.NonceSize()], raw[aead.NonceSize():], nil)
	return string(plain), err
}

// mfaTicket proves the password step passed; it is not a session token.
func (s Service) mfaTicket(userID string) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID, "purpose": "mfa", "exp": time.Now().Add(5 * time.Minute).Unix(),
	}).SignedString([]byte(s.jwtSecret))
}

// checkCode verifies a code against the account's active (or pending) secret
// and refuses a code that was already used.
func (s Service) checkCode(ctx context.Context, userID, code string, pending bool) bool {
	column := "mfa_secret"
	if pending {
		column = "mfa_pending_secret"
	}
	var sealed string
	var last int64
	if s.repository.db.QueryRow(ctx, `SELECT `+column+`,mfa_last_step FROM users WHERE id=$1`, userID).Scan(&sealed, &last) != nil || sealed == "" {
		return false
	}
	secret, err := s.open(sealed)
	if err != nil {
		return false
	}
	step, ok := matchTOTP(secret, code, time.Now())
	if !ok || step <= last {
		return false
	}
	tag, err := s.repository.db.Exec(ctx, `UPDATE users SET mfa_last_step=$2 WHERE id=$1 AND mfa_last_step<$2`, userID, step)
	return err == nil && tag.RowsAffected() == 1
}

func (h Handler) mfaUser(c *gin.Context) (string, bool) {
	id, ok := UserIDFromContext(c)
	if _, viaKey := APIKeyPermissions(c); !ok || viaKey {
		httpx401(c)
		return "", false
	}
	return id, true
}

func httpx401(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Sign in first"})
}

// GET /auth/mfa: whether two-step sign-in is on, and whether it is required.
func (h Handler) MFAStatus(c *gin.Context) {
	id, ok := h.mfaUser(c)
	if !ok {
		return
	}
	var enabled, staff bool
	_ = h.service.repository.db.QueryRow(c.Request.Context(), `SELECT mfa_enabled, role<>'member' OR cardinality(permissions)>0 OR staff_role_id IS NOT NULL FROM users WHERE id=$1`, id).Scan(&enabled, &staff)
	c.JSON(http.StatusOK, gin.H{"enabled": enabled, "required": staff && h.service.policy(c.Request.Context()).MFAForStaff})
}

// POST /auth/mfa/setup: a new secret to scan into an authenticator app.
func (h Handler) MFASetup(c *gin.Context) {
	id, ok := h.mfaUser(c)
	if !ok {
		return
	}
	raw := make([]byte, 20)
	_, _ = rand.Read(raw)
	secret := b32.EncodeToString(raw)
	var email string
	if h.service.repository.db.QueryRow(c.Request.Context(), `UPDATE users SET mfa_pending_secret=$2 WHERE id=$1 RETURNING email`, id, h.service.seal(secret)).Scan(&email) != nil {
		httpx401(c)
		return
	}
	label := url.PathEscape("Shekinah Sons Global:" + email)
	uri := fmt.Sprintf("otpauth://totp/%s?secret=%s&issuer=%s&digits=6&period=30", label, secret, url.QueryEscape("Shekinah Sons Global"))
	c.JSON(http.StatusOK, gin.H{"secret": secret, "otpauthUrl": uri})
}

// POST /auth/mfa/enable {"code"}: confirms the app is set up and turns it on.
func (h Handler) MFAEnable(c *gin.Context) {
	id, ok := h.mfaUser(c)
	if !ok {
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	_ = c.ShouldBindJSON(&req)
	if !h.service.checkCode(c.Request.Context(), id, req.Code, true) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "That code is not right. Check the app shows Shekinah Sons Global and try the newest code."})
		return
	}
	_, _ = h.service.repository.db.Exec(c.Request.Context(), `UPDATE users SET mfa_secret=mfa_pending_secret,mfa_pending_secret='',mfa_enabled=TRUE,updated_at=NOW() WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"enabled": true, "message": "Two-step sign-in is on"})
}

// POST /auth/mfa/disable {"code"}: needs a current code; not allowed when required.
func (h Handler) MFADisable(c *gin.Context) {
	id, ok := h.mfaUser(c)
	if !ok {
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	_ = c.ShouldBindJSON(&req)
	var staff bool
	_ = h.service.repository.db.QueryRow(c.Request.Context(), `SELECT role<>'member' OR cardinality(permissions)>0 OR staff_role_id IS NOT NULL FROM users WHERE id=$1`, id).Scan(&staff)
	if staff && h.service.policy(c.Request.Context()).MFAForStaff {
		c.JSON(http.StatusForbidden, gin.H{"message": "Two-step sign-in is required for staff, so it cannot be turned off"})
		return
	}
	if !h.service.checkCode(c.Request.Context(), id, req.Code, false) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "That code is not right"})
		return
	}
	_, _ = h.service.repository.db.Exec(c.Request.Context(), `UPDATE users SET mfa_enabled=FALSE,mfa_secret='',mfa_pending_secret='',updated_at=NOW() WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"enabled": false, "message": "Two-step sign-in is off"})
}

// POST /auth/mfa/verify {"mfaToken","code"}: the second sign-in step.
func (h Handler) MFAVerify(c *gin.Context) {
	var req struct {
		MFAToken string `json:"mfaToken"`
		Code     string `json:"code"`
	}
	_ = c.ShouldBindJSON(&req)
	token, err := jwt.Parse(req.MFAToken, func(t *jwt.Token) (any, error) { return []byte(h.service.jwtSecret), nil }, jwt.WithValidMethods([]string{"HS256"}))
	claims, _ := token.Claims.(jwt.MapClaims)
	if err != nil || claims["purpose"] != "mfa" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Sign-in expired. Enter your password again."})
		return
	}
	id, _ := claims["sub"].(string)
	if !h.service.checkCode(c.Request.Context(), id, req.Code, false) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "That code is not right"})
		return
	}
	user, err := h.service.repository.FindByID(c.Request.Context(), id)
	if err != nil || !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"message": "account is inactive"})
		return
	}
	response, err := h.service.complete(c.Request.Context(), user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to login"})
		return
	}
	c.JSON(http.StatusOK, response)
}

// Policy is the part of the super admin's Security settings that sign-in uses.
type Policy struct {
	MFAForStaff bool `json:"mfaRequiredForStaff"`
	IdleMinutes int  `json:"idleMinutes"`
}

func (s Service) policy(ctx context.Context) Policy {
	return LoadPolicy(ctx, s.repository.db)
}

// LoadPolicy reads the Security settings; missing values mean off.
func LoadPolicy(ctx context.Context, db interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) Policy {
	var p Policy
	var raw string
	if db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key='security_policies'`).Scan(&raw) == nil {
		_ = json.Unmarshal([]byte(raw), &p)
	}
	return p
}
