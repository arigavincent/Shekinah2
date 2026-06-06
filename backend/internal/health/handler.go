package health

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/httpx"
)

type Response struct {
	Status   string `json:"status"`
	Env      string `json:"env"`
	Database string `json:"database"`
	Time     string `json:"time"`
}

func HandleHealthz(cfg config.Config, db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, Response{
				Status:   "degraded",
				Env:      cfg.AppEnv,
				Database: "down",
				Time:     time.Now().UTC().Format(time.RFC3339),
			})
			return
		}

		httpx.OK(c, Response{
			Status:   "ok",
			Env:      cfg.AppEnv,
			Database: "ok",
			Time:     time.Now().UTC().Format(time.RFC3339),
		})
	}
}
