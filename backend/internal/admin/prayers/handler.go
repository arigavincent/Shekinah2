package prayers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/httpx"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (h Handler) List(c *gin.Context) {
	items, err := h.service.List(c.Request.Context())
	if err != nil {
		log.Printf("admin prayers list failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "prayer_list_failed", "failed to load prayer requests")
		return
	}

	httpx.OK(c, gin.H{
		"prayers": items,
	})
}

func (h Handler) Update(c *gin.Context) {
	reviewerID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	item, err := h.service.Update(c.Request.Context(), c.Param("id"), req, reviewerID)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid prayer status or note is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "prayer_not_found", "prayer request not found")
		default:
			log.Printf("admin prayer update failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "prayer_update_failed", "failed to update prayer request")
		}
		return
	}

	httpx.OK(c, gin.H{
		"prayer": item,
	})
}
