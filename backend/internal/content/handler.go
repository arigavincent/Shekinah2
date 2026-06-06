package content

import (
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

func (h Handler) Home(c *gin.Context) {
	response, err := h.service.Home(c.Request.Context())
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "content_load_failed", "failed to load home content")
		return
	}

	httpx.OK(c, response)
}
