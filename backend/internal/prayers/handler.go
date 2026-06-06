package prayers

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

type CreatePrayerRequest struct {
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Category string `json:"category"`
	Text     string `json:"text"`
}

var (
	kenyanPhonePattern = regexp.MustCompile(`^(?:\+254|254|0)?[17]\d{8}$`)
	emailPattern       = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func (h Handler) Create(c *gin.Context) {
	var req CreatePrayerRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid prayer request payload"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Phone = strings.ReplaceAll(strings.TrimSpace(req.Phone), " ", "")
	req.Email = strings.TrimSpace(req.Email)
	req.Category = strings.TrimSpace(req.Category)
	req.Text = strings.TrimSpace(req.Text)

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Name is required"})
		return
	}

	if req.Phone == "" || !kenyanPhonePattern.MatchString(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid Kenyan phone number is required"})
		return
	}

	if req.Email == "" || !emailPattern.MatchString(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid email address is required"})
		return
	}

	if req.Text == "" || len(req.Text) < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Prayer request must be at least 10 characters"})
		return
	}

	if req.Category == "" {
		req.Category = "Personal"
	}

	id := fmt.Sprintf("pr-%d", time.Now().UnixNano())

	publicText := req.Text
	if req.Category != "" {
		publicText = fmt.Sprintf("[%s] %s", req.Category, req.Text)
	}

	_, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO prayers (id, name, text, prayer_date, count)
			VALUES ($1, $2, $3, $4, $5)
		`,
		id,
		req.Name,
		publicText,
		"Today",
		0,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save prayer request"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"prayer": gin.H{
			"id":    id,
			"name":  req.Name,
			"text":  publicText,
			"date":  "Today",
			"count": 0,
		},
	})
}
