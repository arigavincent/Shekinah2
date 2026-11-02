// Package sermonnotes keeps the notes that go with a sermon (key points,
// scriptures). Members read them under the player; staff who manage sermons
// write them.
package sermonnotes

import (
	"errors"
	"net/http"
	"strings"

	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxNotes = 20000

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) Handler { return Handler{db: db} }

// GET /sermons/:id/notes
func (h Handler) Get(c *gin.Context) {
	var notes string
	err := h.db.QueryRow(c.Request.Context(), `SELECT notes FROM sermon_notes WHERE sermon_id=$1`, c.Param("id")).Scan(&notes)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(c, http.StatusInternalServerError, "notes_failed", "Could not load the notes")
		return
	}
	httpx.OK(c, gin.H{"notes": notes})
}

// PUT /admin/sermons/:id/notes {"notes": "..."}
func (h Handler) Save(c *gin.Context) {
	var req struct {
		Notes string `json:"notes"`
	}
	if c.ShouldBindJSON(&req) != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	notes := strings.TrimSpace(strings.ReplaceAll(req.Notes, "\r\n", "\n"))
	if len(notes) > maxNotes {
		httpx.Error(c, http.StatusBadRequest, "notes_too_long", "Notes can be up to 20,000 characters")
		return
	}
	ctx := c.Request.Context()
	var exists bool
	_ = h.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sermons WHERE id=$1)`, c.Param("id")).Scan(&exists)
	if !exists {
		httpx.Error(c, http.StatusNotFound, "sermon_not_found", "Sermon not found")
		return
	}
	var err error
	if notes == "" {
		_, err = h.db.Exec(ctx, `DELETE FROM sermon_notes WHERE sermon_id=$1`, c.Param("id"))
	} else {
		_, err = h.db.Exec(ctx, `INSERT INTO sermon_notes(sermon_id,notes,updated_at) VALUES($1,$2,now())
			ON CONFLICT (sermon_id) DO UPDATE SET notes=EXCLUDED.notes, updated_at=now()`, c.Param("id"), notes)
	}
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "notes_failed", "Could not save the notes")
		return
	}
	httpx.OK(c, gin.H{"notes": notes, "message": "Sermon notes saved"})
}
