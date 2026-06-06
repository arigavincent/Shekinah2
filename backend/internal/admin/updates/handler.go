package updates

import (
	"errors"
	"log"
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

func (h Handler) List(c *gin.Context) {
	items, err := h.service.List(c.Request.Context())
	if err != nil {
		log.Printf("updates list failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "updates_list_failed", "failed to load updates")
		return
	}

	httpx.OK(c, gin.H{
		"updates": items,
	})
}

func (h Handler) Create(c *gin.Context) {
	var req CreateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	item, err := h.service.Create(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid title, excerpt, and updateDate are required")
		default:
			log.Printf("update create failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "update_create_failed", "failed to create update")
		}
		return
	}

	httpx.Created(c, gin.H{
		"update": item,
	})
}

func (h Handler) Update(c *gin.Context) {
	id := c.Param("id")

	var req UpdateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	item, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "invalid update")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "update_not_found", "update not found")
		default:
			log.Printf("update update failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "update_update_failed", "failed to update update")
		}
		return
	}

	httpx.OK(c, gin.H{
		"update": item,
	})
}

func (h Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid update id is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "update_not_found", "update not found")
		default:
			log.Printf("update delete failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "update_delete_failed", "failed to delete update")
		}
		return
	}

	c.Status(http.StatusNoContent)
}
