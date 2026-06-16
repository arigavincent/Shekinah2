package liveconfig

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

func (h Handler) Get(c *gin.Context) {
	item, err := h.service.Get(c.Request.Context())
	if err != nil {
		log.Printf("live config get failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "live_config_get_failed", "failed to load live config")
		return
	}

	httpx.OK(c, gin.H{
		"liveConfig": item,
	})
}

func (h Handler) CreateCloudflareLiveInput(c *gin.Context) {
	item, err := h.service.CreateCloudflareLiveInput(c.Request.Context())
	if err != nil {
		switch {
		case errors.Is(err, ErrCloudflareNotConfigured):
			httpx.Error(c, http.StatusConflict, "cloudflare_not_configured", "Cloudflare Stream is not configured on the backend")
		default:
			log.Printf("cloudflare live input create failed: %v", err)
			httpx.Error(c, http.StatusBadGateway, "cloudflare_live_input_failed", "failed to create Cloudflare live input")
		}
		return
	}

	httpx.Created(c, gin.H{
		"liveConfig": item,
	})
}

func (h Handler) ResetCloudflareLiveInput(c *gin.Context) {
	item, err := h.service.ResetCloudflareLiveInput(c.Request.Context())
	if err != nil {
		switch {
		case errors.Is(err, ErrCloudflareNotConfigured):
			httpx.Error(c, http.StatusConflict, "cloudflare_not_configured", "Cloudflare Stream is not configured on the backend")
		default:
			log.Printf("cloudflare live input reset failed: %v", err)
			httpx.Error(c, http.StatusBadGateway, "cloudflare_live_input_reset_failed", err.Error())
		}
		return
	}

	httpx.OK(c, gin.H{
		"liveConfig": item,
	})
}

func (h Handler) Update(c *gin.Context) {
	var req UpdateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	item, err := h.service.Update(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid title, nextService, provider, and playback settings are required")
		default:
			log.Printf("live config update failed: %v", err)
			httpx.Error(c, http.StatusInternalServerError, "live_config_update_failed", "failed to update live config")
		}
		return
	}

	httpx.OK(c, gin.H{
		"liveConfig": item,
	})
}
