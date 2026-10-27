package categories

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
		log.Printf("categories list failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "categories_list_failed", "failed to load categories")
		return
	}

	httpx.OK(c, gin.H{
		"categories": items,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "a category name (up to 60 characters) is required")
		default:
			log.Printf("category create failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "category_create_failed", "failed to create category")
		}
		return
	}

	httpx.Created(c, gin.H{
		"category": item,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "a category name (up to 60 characters) is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "category_not_found", "category not found")
		default:
			log.Printf("category update failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "category_update_failed", "failed to update category")
		}
		return
	}

	httpx.OK(c, gin.H{
		"category": item,
	})
}

func (h Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid category id is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "category_not_found", "category not found")
		default:
			log.Printf("category delete failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "category_delete_failed", "failed to delete category")
		}
		return
	}

	c.Status(http.StatusNoContent)
}
