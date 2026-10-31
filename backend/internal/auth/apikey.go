package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// API keys let another system act for the super admin who created the key,
// limited to the permissions chosen for it. They never count as an admin.
type apiKeyScope struct{}

const contextAPIKeyKey = "auth_api_key_permissions"

// HashAPIKey is how keys are stored; the plain key is shown once at creation.
func HashAPIKey(key string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(key)))
	return hex.EncodeToString(sum[:])
}

// APIKeyPermissions reports the permissions of the API key behind a request,
// and whether the request was made with an API key at all.
func APIKeyPermissions(ctx context.Context) ([]string, bool) {
	if gc, ok := ctx.(*gin.Context); ok {
		if v, ok := gc.Get(contextAPIKeyKey); ok {
			perms, _ := v.([]string)
			return perms, true
		}
		if gc.Request == nil {
			return nil, false
		}
		ctx = gc.Request.Context()
	}
	perms, ok := ctx.Value(apiKeyScope{}).([]string)
	return perms, ok
}

func (s Service) parseAPIKey(ctx context.Context, key string) (string, []string, error) {
	var userID string
	var perms []string
	err := s.repository.db.QueryRow(ctx, `
		UPDATE api_keys k SET last_used_at = NOW()
		FROM users u
		WHERE k.key_hash = $1 AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > NOW())
		  AND u.id = k.created_by AND u.is_active AND u.role = 'super_admin'
		RETURNING u.id::text, k.permissions`, HashAPIKey(key)).Scan(&userID, &perms)
	if err != nil {
		return "", nil, errors.New("invalid API key")
	}
	return userID, perms, nil
}

func useAPIKey(c *gin.Context, userID string, perms []string) {
	c.Set(contextUserIDKey, userID)
	c.Set(contextAPIKeyKey, perms)
	c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), apiKeyScope{}, perms))
}

// MinPasswordLength is the minimum set by a super admin in Security; never below 8.
func MinPasswordLength(ctx context.Context, db interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) int {
	var n int
	if db.QueryRow(ctx, `SELECT COALESCE((value::jsonb->>'minPasswordLength')::int,8) FROM app_settings WHERE key='security_policies'`).Scan(&n) != nil {
		return 8
	}
	return max(8, min(n, 64))
}

// MinPasswordLength for this service's database.
func (s Service) MinPasswordLength(ctx context.Context) int {
	return MinPasswordLength(ctx, s.repository.db)
}
