package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
)

var ErrInvalidPhone = errors.New("invalid phone number")

// NormalizePhone turns the ways people type a phone number into one form:
// Kenyan numbers (0712 345 678, 712345678, 254712345678, +254 712 345 678)
// become +254712345678; other countries must start with + and a country code.
func NormalizePhone(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	plus := strings.HasPrefix(s, "+")
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, s)
	switch {
	case strings.HasPrefix(digits, "254") && len(digits) == 12:
		digits = digits[3:]
	case strings.HasPrefix(digits, "0") && len(digits) == 10 && !plus:
		digits = digits[1:]
	case plus && !strings.HasPrefix(digits, "254"):
		if len(digits) >= 8 && len(digits) <= 15 {
			return "+" + digits, nil
		}
		return "", ErrInvalidPhone
	}
	if len(digits) == 9 && (digits[0] == '7' || digits[0] == '1') {
		return "+254" + digits, nil
	}
	return "", ErrInvalidPhone
}

type phoneRequest struct {
	Phone string `json:"phone"`
}

// PATCH /auth/phone — members add or change their phone number.
func (h Handler) UpdatePhone(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var req phoneRequest
	if c.ShouldBindJSON(&req) != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	phone, err := NormalizePhone(req.Phone)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_phone", "Enter a valid phone number, e.g. 0712 345 678")
		return
	}
	if err := h.service.repository.UpdatePhone(c.Request.Context(), userID, phone); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "phone_update_failed", "Could not save the phone number")
		return
	}
	user, err := h.service.Me(c.Request.Context(), userID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "me_failed", "failed to load user")
		return
	}
	httpx.OK(c, gin.H{"user": user})
}

type profileRequest struct {
	Name  *string `json:"name"`
	Phone *string `json:"phone"`
}

// UpdateProfile lets members correct their own name and phone number.
func (h Handler) UpdateProfile(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var req profileRequest
	if c.ShouldBindJSON(&req) != nil || (req.Name == nil && req.Phone == nil) {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "send a name or a phone number")
		return
	}
	var name, phone string
	if req.Name != nil {
		name = strings.Join(strings.Fields(*req.Name), " ")
		if len([]rune(name)) < 2 || len([]rune(name)) > 80 {
			httpx.Error(c, http.StatusBadRequest, "invalid_name", "Enter your name (2 to 80 characters)")
			return
		}
	}
	if req.Phone != nil {
		var err error
		if phone, err = NormalizePhone(*req.Phone); err != nil {
			httpx.Error(c, http.StatusBadRequest, "invalid_phone", "Enter a valid phone number, e.g. 0712 345 678")
			return
		}
	}
	ctx := c.Request.Context()
	if name != "" {
		if err := h.service.repository.UpdateName(ctx, userID, name); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "profile_update_failed", "Could not save your details")
			return
		}
	}
	if phone != "" {
		if err := h.service.repository.UpdatePhone(ctx, userID, phone); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "profile_update_failed", "Could not save your details")
			return
		}
	}
	user, err := h.service.Me(ctx, userID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "me_failed", "failed to load user")
		return
	}
	httpx.OK(c, gin.H{"user": user})
}
