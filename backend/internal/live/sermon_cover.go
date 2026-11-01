package live

// Automatic covers for sermons without an uploaded cover: the same bright
// Shekinah design as service replays, labelled AUDIO SERMON or SERMON.
import (
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	sermonCoverMu    sync.Mutex
	sermonCoverCache = map[string][]byte{}
)

// GET /covers/sermons/:file (file = <sermon id>.jpg)
func (h *Handler) SermonCover(c *gin.Context) {
	id := strings.TrimSuffix(c.Param("file"), ".jpg")
	var title, speaker, kind string
	var date *time.Time
	if h.db.QueryRow(c.Request.Context(), `SELECT title, speaker, type, sermon_date FROM sermons WHERE id=$1 AND is_published`, id).Scan(&title, &speaker, &kind, &date) != nil {
		c.Status(404)
		return
	}
	key := id + "|" + title + "|" + speaker + "|" + kind
	sermonCoverMu.Lock()
	img, ok := sermonCoverCache[key]
	sermonCoverMu.Unlock()
	if !ok {
		label := "SERMON"
		if kind == "audio" {
			label = "AUDIO SERMON"
		}
		sub := strings.TrimSpace(speaker)
		if date != nil && !date.IsZero() {
			if sub != "" {
				sub += "  ·  "
			}
			sub += date.Format("2 January 2006")
		}
		var err error
		if img, err = RenderCover(id, label, title, sub); err != nil {
			c.Status(500)
			return
		}
		sermonCoverMu.Lock()
		if len(sermonCoverCache) > 400 {
			sermonCoverCache = map[string][]byte{}
		}
		sermonCoverCache[key] = img
		sermonCoverMu.Unlock()
	}
	c.Header("Cache-Control", "public, max-age=86400")
	c.Header("Content-Type", "image/jpeg") // a global middleware presets JSON
	c.Data(200, "image/jpeg", img)
}

// GET /covers/plans/:file (file = <plan id>.jpg): bright cover for reading plans.
func (h *Handler) PlanCover(c *gin.Context) {
	id := strings.TrimSuffix(c.Param("file"), ".jpg")
	var title string
	var days int
	if h.db.QueryRow(c.Request.Context(), `SELECT title, duration_days FROM reading_plans WHERE id=$1`, id).Scan(&title, &days) != nil {
		c.Status(404)
		return
	}
	key := "plan|" + id + "|" + title + "|" + strconv.Itoa(days)
	sermonCoverMu.Lock()
	img, ok := sermonCoverCache[key]
	sermonCoverMu.Unlock()
	if !ok {
		sub := "Shekinah Sons Global"
		if days > 0 {
			sub = strconv.Itoa(days) + "-day plan  ·  " + sub
		}
		var err error
		if img, err = RenderCover(id, "READING PLAN", title, sub); err != nil {
			c.Status(500)
			return
		}
		sermonCoverMu.Lock()
		sermonCoverCache[key] = img
		sermonCoverMu.Unlock()
	}
	c.Header("Cache-Control", "public, max-age=86400")
	c.Header("Content-Type", "image/jpeg")
	c.Data(200, "image/jpeg", img)
}
