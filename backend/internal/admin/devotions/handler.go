package devotions

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
		log.Printf("devotions list failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "devotions_list_failed", "failed to load devotions")
		return
	}

	httpx.OK(c, gin.H{
		"devotions": items,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid title, excerpt, devotionDate, and body are required")
		default:
			log.Printf("devotion create failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "devotion_create_failed", "failed to create devotion")
		}
		return
	}

	httpx.Created(c, gin.H{
		"devotion": item,
	})
}

func (h Handler) Import(c *gin.Context) {
	var req ImportRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	result, err := h.service.Import(c.Request.Context(), req.CSV)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid CSV with scheduling columns is required")
		default:
			log.Printf("devotion import failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "devotion_import_failed", "failed to import devotions")
		}
		return
	}

	httpx.OK(c, gin.H{"result": result})
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "invalid devotion update")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "devotion_not_found", "devotion not found")
		default:
			log.Printf("devotion update failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "devotion_update_failed", "failed to update devotion")
		}
		return
	}

	httpx.OK(c, gin.H{
		"devotion": item,
	})
}

func (h Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid devotion id is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "devotion_not_found", "devotion not found")
		default:
			log.Printf("devotion delete failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "devotion_delete_failed", "failed to delete devotion")
		}
		return
	}

	c.Status(http.StatusNoContent)
}
