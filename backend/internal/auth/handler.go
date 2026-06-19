package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ariga/shekinah-backend/internal/httpx"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (h Handler) Register(c *gin.Context) {
	var req RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	response, err := h.service.Register(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "name, valid email, and password of at least 8 characters are required")
		case errors.Is(err, ErrEmailTaken):
			httpx.Error(c, http.StatusConflict, "email_taken", "email is already registered")
		default:
			httpx.Error(c, http.StatusInternalServerError, "register_failed", "failed to register user")
		}
		return
	}

	httpx.Created(c, response)
}

func (h Handler) Login(c *gin.Context) {
	var req LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	response, err := h.service.Login(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidCredentials):
			httpx.Error(c, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		case errors.Is(err, ErrInactiveUser):
			httpx.Error(c, http.StatusForbidden, "inactive_user", "account is inactive")
		default:
			httpx.Error(c, http.StatusInternalServerError, "login_failed", "failed to login")
		}
		return
	}

	httpx.OK(c, response)
}

func (h Handler) RequestPasswordReset(c *gin.Context) {
	var req PasswordResetRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if err := h.service.RequestPasswordReset(c.Request.Context(), req); err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid email is required")
		default:
			httpx.Error(c, http.StatusInternalServerError, "password_reset_request_failed", "failed to request password reset")
		}
		return
	}

	httpx.OK(c, gin.H{
		"message": "If this email is registered, a reset code has been sent.",
	})
}

func (h Handler) ConfirmPasswordReset(c *gin.Context) {
	var req PasswordResetConfirmRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	response, err := h.service.ConfirmPasswordReset(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "email, code, and new password are required")
		case errors.Is(err, ErrWeakPassword):
			httpx.Error(c, http.StatusBadRequest, "weak_password", "new password must be at least 8 characters")
		case errors.Is(err, ErrPasswordReused):
			httpx.Error(c, http.StatusBadRequest, "password_reused", "new password must be different from the current password")
		case errors.Is(err, ErrInvalidResetCode):
			httpx.Error(c, http.StatusBadRequest, "invalid_reset_code", "reset code is invalid or expired")
		case errors.Is(err, ErrResetCodeLocked):
			httpx.Error(c, http.StatusTooManyRequests, "reset_code_locked", "too many failed attempts; request a new code")
		case errors.Is(err, ErrInactiveUser):
			httpx.Error(c, http.StatusForbidden, "inactive_user", "account is inactive")
		default:
			httpx.Error(c, http.StatusInternalServerError, "password_reset_confirm_failed", "failed to reset password")
		}
		return
	}

	httpx.OK(c, response)
}

func (h Handler) Me(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	user, err := h.service.Me(c.Request.Context(), userID)
	if err != nil {
		switch {
		case errors.Is(err, ErrUserNotFound):
			httpx.Error(c, http.StatusUnauthorized, "unauthorized", "user not found")
		case errors.Is(err, ErrInactiveUser):
			httpx.Error(c, http.StatusForbidden, "inactive_user", "account is inactive")
		default:
			httpx.Error(c, http.StatusInternalServerError, "me_failed", "failed to load user")
		}
		return
	}

	httpx.OK(c, gin.H{
		"user": user,
	})
}

func (h Handler) ChangePassword(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	response, err := h.service.ChangePassword(c.Request.Context(), userID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "current password and new password are required")
		case errors.Is(err, ErrWeakPassword):
			httpx.Error(c, http.StatusBadRequest, "weak_password", "new password must be at least 12 characters")
		case errors.Is(err, ErrPasswordReused):
			httpx.Error(c, http.StatusBadRequest, "password_reused", "new password must be different from the current password")
		case errors.Is(err, ErrInvalidCredentials):
			httpx.Error(c, http.StatusUnauthorized, "invalid_credentials", "current password is incorrect")
		case errors.Is(err, ErrInactiveUser):
			httpx.Error(c, http.StatusForbidden, "inactive_user", "account is inactive")
		default:
			httpx.Error(c, http.StatusInternalServerError, "password_change_failed", "failed to change password")
		}
		return
	}

	httpx.OK(c, response)
}
