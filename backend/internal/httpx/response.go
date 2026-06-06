package httpx

import "github.com/gin-gonic/gin"

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func OK(c *gin.Context, payload any) {
	c.JSON(200, payload)
}

func Created(c *gin.Context, payload any) {
	c.JSON(201, payload)
}

func Error(c *gin.Context, status int, code string, message string) {
	c.JSON(status, ErrorResponse{
		Error:   code,
		Message: message,
	})
}
