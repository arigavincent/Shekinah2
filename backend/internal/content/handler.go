package content

import (
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ariga/shekinah-backend/internal/httpx"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return Handler{service: service}
}

func (h Handler) Home(c *gin.Context) {
	response, err := h.service.Home(c.Request.Context())
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "content_load_failed", "failed to load home content")
		return
	}

	// A podcast feed usually gives every episode the same show picture; that
	// counts as no cover, so those episodes get the bright automatic one too.
	shared := map[string]int{}
	for _, s := range response.Sermons {
		if s.Source == "podcast" && s.Thumbnail != "" {
			shared[s.Thumbnail]++
		}
	}
	for i, s := range response.Sermons {
		if s.Source == "podcast" && shared[s.Thumbnail] > 2 {
			response.Sermons[i].Thumbnail = ""
		}
	}

	// Sermons without an uploaded cover get the bright automatic one.
	for i := range response.Sermons {
		s := response.Sermons[i]
		if id := YouTubeID(s.MediaURL); id != "" {
			response.Sermons[i].YouTubeID = id
			response.Sermons[i].Type = "video"
			if strings.TrimSpace(s.Thumbnail) == "" {
				response.Sermons[i].Thumbnail = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"
			}
			continue
		}
		if strings.TrimSpace(s.Thumbnail) == "" && !strings.HasPrefix(s.ID, "replay-") {
			sum := sha1.Sum([]byte(s.Title + "|" + s.Speaker + "|" + s.Type))
			response.Sermons[i].Thumbnail = baseURL(c) + "/api/v1/covers/sermons/" + url.PathEscape(s.ID) + ".jpg?v=" + hex.EncodeToString(sum[:4])
		}
	}
	httpx.OK(c, response)
}

func baseURL(c *gin.Context) string {
	proto := c.GetHeader("X-Forwarded-Proto")
	if proto == "" {
		proto = "http"
		if c.Request.TLS != nil {
			proto = "https"
		}
	}
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	return strings.Split(proto, ",")[0] + "://" + strings.Split(host, ",")[0]
}
