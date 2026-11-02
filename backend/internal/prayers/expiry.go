package prayers

// The prayer wall stays fresh: a request leaves the public wall after a set
// number of days (30 by default). Two days before, its owner is reminded and
// can keep it up for another period or mark it answered. Requests the pastoral
// team pins stay up. A year after leaving the wall a request is deleted.
import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
)

const (
	wallDaysKey     = "prayer_wall_days"
	defaultWallDays = 30
	keepAfterDays   = 365
)

// Reminder sends a push message to one member.
type Reminder func(ctx context.Context, userID, title, body string, data map[string]interface{})

// WithReminder lets the expiry watcher remind members before a request leaves the wall.
func (h Handler) WithReminder(r Reminder) Handler {
	h.remind = r
	return h
}

func (h Handler) wallDays(ctx context.Context) int {
	var v string
	if h.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key=$1`, wallDaysKey).Scan(&v) == nil {
		if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n >= 1 && n <= 365 {
			return n
		}
	}
	return defaultWallDays
}

// onWall is the SQL condition for a request currently shown on the wall ($N = days).
func onWall(param string) string {
	return "(pinned OR shown_from > now() - make_interval(days => " + param + "))"
}

// POST /prayer-requests/:id/keep — the owner keeps the request up for another period.
func (h Handler) Keep(c *gin.Context) {
	h.ownerUpdate(c, `UPDATE prayers SET shown_from=now(), reminded_at=NULL, updated_at=now() WHERE id=$1 AND owner_user_id=$2 AND status<>'hidden'`, "Your request stays on the prayer wall")
}

// POST /prayer-requests/:id/answered — the owner marks the prayer answered.
func (h Handler) Answered(c *gin.Context) {
	h.ownerUpdate(c, `UPDATE prayers SET status='answered', answered_at=now(), updated_at=now() WHERE id=$1 AND owner_user_id=$2 AND status<>'hidden'`, "Praise God! Marked as answered")
}

func (h Handler) ownerUpdate(c *gin.Context, query, message string) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), query, c.Param("id"), userID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_update_failed", "Could not update the request")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "prayer_not_found", "Prayer request not found")
		return
	}
	httpx.OK(c, gin.H{"message": message})
}

// GET /admin/prayers/settings
func (h Handler) AdminSettings(c *gin.Context) {
	httpx.OK(c, gin.H{"wallDays": h.wallDays(c.Request.Context())})
}

// PUT /admin/prayers/settings {"wallDays": 30}
func (h Handler) AdminSaveSettings(c *gin.Context) {
	var req struct {
		WallDays int `json:"wallDays"`
	}
	if c.ShouldBindJSON(&req) != nil || req.WallDays < 1 || req.WallDays > 365 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "Choose between 1 and 365 days")
		return
	}
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,now())
		ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, wallDaysKey, strconv.Itoa(req.WallDays)); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "settings_failed", "Could not save")
		return
	}
	httpx.OK(c, gin.H{"wallDays": req.WallDays, "message": "Prayer wall setting saved"})
}

// PATCH /admin/prayers/:id/pin {"pinned": true}
func (h Handler) AdminPin(c *gin.Context) {
	var req struct {
		Pinned *bool `json:"pinned"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Pinned == nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "Say whether to pin the request")
		return
	}
	// Unpinning starts a fresh period so it doesn't vanish the same minute.
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE prayers SET pinned=$2, shown_from=CASE WHEN $2 THEN shown_from ELSE now() END, updated_at=now() WHERE id=$1`, c.Param("id"), *req.Pinned)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "prayer_not_found", "Prayer request not found")
		return
	}
	httpx.OK(c, gin.H{"pinned": *req.Pinned, "message": map[bool]string{true: "Pinned to the prayer wall", false: "Unpinned"}[*req.Pinned]})
}

// ExpiryWatch reminds owners and clears out old requests, every hour.
func (h Handler) ExpiryWatch(ctx context.Context) {
	tick := time.NewTicker(time.Hour)
	defer tick.Stop()
	for {
		h.ExpiryPass(ctx)
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

// ExpiryPass runs one round of reminders and clean-up.
func (h Handler) ExpiryPass(ctx context.Context) {
	days := h.wallDays(ctx)
	if h.remind != nil {
		// Two days before leaving the wall (or halfway, for very short periods).
		before := 2
		if days <= 4 {
			before = days / 2
		}
		rows, err := h.db.Query(ctx, `UPDATE prayers SET reminded_at=now()
			WHERE owner_user_id IS NOT NULL AND is_public AND NOT pinned AND reminded_at IS NULL
			  AND status NOT IN ('hidden','answered')
			  AND shown_from <= now() - make_interval(days => $1) AND shown_from > now() - make_interval(days => $2)
			RETURNING id, owner_user_id::text`, days-before, days)
		if err == nil {
			type due struct{ id, user string }
			var list []due
			for rows.Next() {
				var d due
				if rows.Scan(&d.id, &d.user) == nil {
					list = append(list, d)
				}
			}
			rows.Close()
			for _, d := range list {
				h.remind(ctx, d.user, "Still need prayer?",
					"Your prayer request leaves the prayer wall soon. Keep it up for another month, or tell the church it's been answered.",
					map[string]interface{}{"open": "prayer", "id": d.id})
			}
		} else {
			log.Printf("prayer reminders: %v", err)
		}
	}
	if _, err := h.db.Exec(ctx, `DELETE FROM prayers WHERE NOT pinned AND shown_from < now() - make_interval(days => $1)`, days+keepAfterDays); err != nil {
		log.Printf("prayer cleanup: %v", err)
	}
}
