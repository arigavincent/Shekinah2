package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ariga/shekinah-backend/internal/httpx"
)

const contextUserIDKey = "auth_user_id"

func RequireAuth(service Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "missing authorization header")
			c.Abort()
			return
		}

		const prefix = "Bearer "
		if !strings.HasPrefix(header, prefix) {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "invalid authorization header")
			c.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
		if token == "" {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "missing bearer token")
			c.Abort()
			return
		}

		userID, err := service.ParseToken(token)
		if err != nil {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
			c.Abort()
			return
		}

		c.Set(contextUserIDKey, userID)
		c.Next()
	}
}

func UserIDFromContext(c *gin.Context) (string, bool) {
	value, ok := c.Get(contextUserIDKey)
	if !ok {
		return "", false
	}

	userID, ok := value.(string)
	return userID, ok && userID != ""
}

func RequireRole(service Service, allowedRoles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedRoles))

	for _, role := range allowedRoles {
		allowed[role] = true
	}

	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "missing authorization header")
			c.Abort()
			return
		}

		const prefix = "Bearer "
		if !strings.HasPrefix(header, prefix) {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "invalid authorization header")
			c.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
		if token == "" {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "missing bearer token")
			c.Abort()
			return
		}

		userID, err := service.ParseToken(token)
		if err != nil {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
			c.Abort()
			return
		}

		user, err := service.Me(c.Request.Context(), userID)
		if err != nil {
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "invalid user")
			c.Abort()
			return
		}

		if !allowed[user.Role] {
			httpx.Error(c, http.StatusForbidden, "forbidden", "admin access required")
			c.Abort()
			return
		}

		if user.PasswordResetRequired {
			httpx.Error(c, http.StatusForbidden, "password_reset_required", "password reset required before admin access")
			c.Abort()
			return
		}

		c.Set(contextUserIDKey, userID)
		c.Set("auth_user_role", user.Role)

		c.Next()
	}
}
