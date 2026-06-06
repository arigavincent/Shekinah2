package httpx

import (
	"log"
	"net/http"
	"runtime/debug"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := strconv.FormatInt(time.Now().UnixNano(), 36)

		c.Header("X-Request-ID", requestID)
		c.Set("request_id", requestID)

		c.Next()
	}
}

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		log.Printf(
			"%s %s %d %s",
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			time.Since(start),
		)
	}
}

func Recoverer() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			value := recover()
			if value == nil {
				return
			}

			log.Printf("panic: %v\n%s", value, string(debug.Stack()))

			Error(c, http.StatusInternalServerError, "internal_error", "internal server error")
			c.Abort()
		}()

		c.Next()
	}
}

func JSONHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		if len(c.Request.URL.Path) >= 8 && c.Request.URL.Path[:8] == "/uploads" {
			c.Next()
			return
		}

		c.Header("Content-Type", "application/json")
		c.Next()
	}
}
