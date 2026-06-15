package sermons

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

func (h Handler) List(c *gin.Context) {
	items, err := h.service.List(c.Request.Context())
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "sermons_list_failed", "failed to load sermons")
		return
	}

	httpx.OK(c, gin.H{
		"sermons": items,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid sermon type, title, speaker, sermonDate, and description are required")
		default:
			httpx.Error(c, http.StatusInternalServerError, "sermon_create_failed", "failed to create sermon")
		}
		return
	}

	httpx.Created(c, gin.H{
		"sermon": item,
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
			httpx.Error(c, http.StatusInternalServerError, "sermon_import_failed", "failed to import sermons")
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "invalid sermon update")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "sermon_not_found", "sermon not found")
		default:
			httpx.Error(c, http.StatusInternalServerError, "sermon_update_failed", "failed to update sermon")
		}
		return
	}

	httpx.OK(c, gin.H{
		"sermon": item,
	})
}

func (h Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid sermon id is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "sermon_not_found", "sermon not found")
		default:
			httpx.Error(c, http.StatusInternalServerError, "sermon_delete_failed", "failed to delete sermon")
		}
		return
	}

	c.Status(http.StatusNoContent)
}
