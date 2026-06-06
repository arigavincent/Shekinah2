package events

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
		log.Printf("events list failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "events_list_failed", "failed to load events")
		return
	}

	httpx.OK(c, gin.H{
		"events": items,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid title, eventDate, eventTime, location, and description are required")
		default:
			log.Printf("event create failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "event_create_failed", "failed to create event")
		}
		return
	}

	httpx.Created(c, gin.H{
		"event": item,
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
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "invalid event update")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "event_not_found", "event not found")
		default:
			log.Printf("event update failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "event_update_failed", "failed to update event")
		}
		return
	}

	httpx.OK(c, gin.H{
		"event": item,
	})
}

func (h Handler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid event id is required")
		case errors.Is(err, ErrNotFound):
			httpx.Error(c, http.StatusNotFound, "event_not_found", "event not found")
		default:
			log.Printf("event delete failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "event_delete_failed", "failed to delete event")
		}
		return
	}

	c.Status(http.StatusNoContent)
}
