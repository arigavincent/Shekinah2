package admin

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ariga/shekinah-backend/internal/httpx"
)

type Handler struct{}

func NewHandler() Handler {
	return Handler{}
}

func (h Handler) Healthz(c *gin.Context) {
	httpx.OK(c, gin.H{
		"status": "ok",
		"scope":  "admin",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}
