package settings

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const serveWhatsAppNumberKey = "serve_whatsapp_number"

type Handler struct {
	db *pgxpool.Pool
}

type ServeSettings struct {
	WhatsAppNumber string `json:"whatsappNumber"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

var nonDigitPattern = regexp.MustCompile(`\D+`)

func normalizeWhatsAppNumber(value string) string {
	number := nonDigitPattern.ReplaceAllString(strings.TrimSpace(value), "")

	if strings.HasPrefix(number, "0") && len(number) == 10 {
		return "254" + number[1:]
	}

	if strings.HasPrefix(number, "7") && len(number) == 9 {
		return "254" + number
	}

	if strings.HasPrefix(number, "1") && len(number) == 9 {
		return "254" + number
	}

	return number
}

func validWhatsAppNumber(value string) bool {
	if value == "" {
		return true
	}

	matched, _ := regexp.MatchString(`^254[17]\d{8}$`, value)
	return matched
}

func (h Handler) getSetting(c *gin.Context, key string) (string, error) {
	var value string

	err := h.db.QueryRow(
		c.Request.Context(),
		`SELECT value FROM app_settings WHERE key = $1`,
		key,
	).Scan(&value)

	return value, err
}

func (h Handler) GetServe(c *gin.Context) {
	value, err := h.getSetting(c, serveWhatsAppNumberKey)
	if err != nil {
		httpx.OK(c, gin.H{
			"serve": ServeSettings{
				WhatsAppNumber: "",
			},
		})
		return
	}

	httpx.OK(c, gin.H{
		"serve": ServeSettings{
			WhatsAppNumber: value,
		},
	})
}

func (h Handler) AdminGetServe(c *gin.Context) {
	h.GetServe(c)
}

func (h Handler) AdminUpdateServe(c *gin.Context) {
	var payload struct {
		WhatsAppNumber string `json:"whatsappNumber"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid serve settings payload")
		return
	}

	number := normalizeWhatsAppNumber(payload.WhatsAppNumber)
	if !validWhatsAppNumber(number) {
		httpx.Error(c, http.StatusBadRequest, "invalid_whatsapp_number", "use a valid WhatsApp number such as 254712345678")
		return
	}

	_, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO app_settings (key, value, updated_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (key)
			DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`,
		serveWhatsAppNumberKey,
		number,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "serve_settings_save_failed", "failed to save serve settings")
		return
	}

	httpx.OK(c, gin.H{
		"serve": ServeSettings{
			WhatsAppNumber: number,
		},
	})
}
