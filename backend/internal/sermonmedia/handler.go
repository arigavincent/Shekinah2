package sermonmedia

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	adminsermons "github.com/ariga/shekinah-backend/internal/admin/sermons"
	"github.com/ariga/shekinah-backend/internal/httpx"
)

type Handler struct {
	service Service
	r2      R2Presigner
}

func NewHandler(service Service) Handler {
	return Handler{service: service, r2: NewR2PresignerFromEnv()}
}

// StartDirectUpload returns a short-lived URL the dashboard PUTs a sermon
// file to in R2, and the public URL to save as the sermon's media.
func (h Handler) StartDirectUpload(c *gin.Context) {
	var req DirectUploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	upload, err := h.r2.Presign(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrR2NotConfigured):
			httpx.Error(c, http.StatusServiceUnavailable, "r2_not_configured", "R2 storage is not configured on the server")
		case errors.Is(err, ErrInvalidUpload):
			httpx.Error(c, http.StatusBadRequest, "invalid_upload", err.Error())
		default:
			httpx.Error(c, http.StatusInternalServerError, "presign_failed", "could not prepare the upload")
		}
		return
	}

	httpx.OK(c, upload)
}

// StorageStatus tells the dashboard which upload paths are available.
func (h Handler) StorageStatus(c *gin.Context) {
	service, err := h.service.current(c.Request.Context())
	if err != nil {
		httpx.Error(c, 503, "provider_unavailable", "Stream settings are unavailable")
		return
	}
	httpx.OK(c, gin.H{
		"r2":     h.r2.Configured(),
		"stream": service.stream.Configured(),
	})
}

// StartStreamUpload reserves a Cloudflare Stream upload for a new video sermon.
func (h Handler) StartStreamUpload(c *gin.Context) {
	var req StartUploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	result, err := h.service.StartUpload(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrStreamNotConfigured):
			httpx.Error(c, http.StatusServiceUnavailable, "stream_not_configured", "Cloudflare Stream is not configured on the server")
		case errors.Is(err, adminsermons.ErrInvalidInput):
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "title, speaker, sermon date and description are required")
		default:
			httpx.Error(c, http.StatusBadGateway, "stream_upload_failed", err.Error())
		}
		return
	}

	httpx.Created(c, result)
}

// SyncNow runs the media sync immediately and reports what changed.
func (h Handler) SyncNow(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	httpx.OK(c, gin.H{"report": h.service.Sync(ctx)})
}

func (h Handler) GetPodcastSettings(c *gin.Context) {
	feedURL, _ := h.service.podcastFeedURL(c.Request.Context())
	httpx.OK(c, gin.H{"feedUrl": feedURL})
}

type podcastSettingsRequest struct {
	FeedURL string `json:"feedUrl"`
}

// UpdatePodcastSettings saves the feed URL after checking it is a readable
// podcast feed. An empty URL turns podcast sync off.
func (h Handler) UpdatePodcastSettings(c *gin.Context) {
	var req podcastSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	feedURL := strings.TrimSpace(req.FeedURL)
	episodes := 0

	if feedURL != "" {
		parsed, err := url.Parse(feedURL)
		if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
			httpx.Error(c, http.StatusBadRequest, "invalid_feed_url", "enter the podcast's RSS feed URL, starting with https://")
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
		defer cancel()

		items, err := h.service.podcast.Fetch(ctx, feedURL)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, "feed_unreadable", "that link is not a readable podcast feed: "+err.Error())
			return
		}
		episodes = len(items)
	}

	_, err := h.service.db.Exec(c.Request.Context(), `
		INSERT INTO app_settings (key, value, updated_at)
		VALUES ('podcast_feed_url', $1, now())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
	`, feedURL)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "settings_save_failed", "failed to save podcast settings")
		return
	}

	httpx.OK(c, gin.H{"feedUrl": feedURL, "episodes": episodes})
}
