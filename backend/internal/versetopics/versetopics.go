// Package versetopics: the topics the church wants the daily verses drawn
// from (e.g. "faith" and "healing" during a healing series). The app has the
// verses for each topic offline; this only says which topics to use.
package versetopics

import (
	"encoding/json"
	"net/http"

	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const key = "verse_topics"

// Topics the app knows (keep in step with the app's DailyWord).
var Known = []string{"faith", "hope", "love", "peace", "strength", "healing", "provision", "prayer", "salvation", "guidance", "thanksgiving", "holyspirit"}

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) Handler { return Handler{db: db} }

func (h Handler) load(c *gin.Context) []string {
	var raw string
	topics := []string{}
	if h.db.QueryRow(c.Request.Context(), `SELECT value FROM app_settings WHERE key=$1`, key).Scan(&raw) == nil {
		_ = json.Unmarshal([]byte(raw), &topics)
	}
	return topics
}

// GET /settings/verse-topics — empty means "all topics".
func (h Handler) Get(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=300")
	httpx.OK(c, gin.H{"topics": h.load(c), "known": Known})
}

// PUT /admin/settings/verse-topics {"topics": ["faith","healing"]}
func (h Handler) Save(c *gin.Context) {
	var req struct {
		Topics []string `json:"topics"`
	}
	if c.ShouldBindJSON(&req) != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	known := map[string]bool{}
	for _, t := range Known {
		known[t] = true
	}
	clean := []string{}
	seen := map[string]bool{}
	for _, t := range req.Topics {
		if known[t] && !seen[t] {
			clean = append(clean, t)
			seen[t] = true
		}
	}
	raw, _ := json.Marshal(clean)
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW())
		ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, key, string(raw)); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "settings_failed", "Could not save")
		return
	}
	httpx.OK(c, gin.H{"topics": clean, "message": "Daily verse topics saved"})
}
