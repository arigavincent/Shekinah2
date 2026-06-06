package branches

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
		log.Printf("branches list failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "branches_list_failed", "failed to load branches")
		return
	}

	httpx.OK(c, gin.H{
		"branches": items,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid name, address, services, phone, latitude, and longitude are required")
		default:
			log.Printf("branch create failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "branch_create_failed", "failed to create branch")
		}
		return
	}

	httpx.Created(c, gin.H{
		"branch": item,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "invalid branch update")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "branch_not_found", "branch not found")
		default:
			log.Printf("branch update failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "branch_update_failed", "failed to update branch")
		}
		return
	}

	httpx.OK(c, gin.H{
		"branch": item,
	})
}

func (h Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid branch id is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "branch_not_found", "branch not found")
		default:
			log.Printf("branch delete failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "branch_delete_failed", "failed to delete branch")
		}
		return
	}

	c.Status(http.StatusNoContent)
}
