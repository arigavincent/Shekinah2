// Package playlists: Spotify-style sermon playlists. Members keep their own
// (create, rename, reorder, delete); staff who manage sermons publish official
// ones that every member sees.
package playlists

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	maxPlaylists = 100
	maxItems     = 500
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) Handler { return Handler{db: db} }

type Playlist struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CoverURL    string    `json:"coverUrl"`
	Official    bool      `json:"official"`
	Mine        bool      `json:"mine"`
	Items       []string  `json:"items"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type body struct {
	Name        *string   `json:"name"`
	Description *string   `json:"description"`
	CoverURL    *string   `json:"coverUrl"`
	Items       *[]string `json:"items"`
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "pl-" + hex.EncodeToString(b)
}

func cleanItems(in []string) []string {
	out := make([]string, 0, len(in))
	seen := map[string]bool{}
	for _, id := range in {
		id = strings.TrimSpace(id)
		if id == "" || len(id) > 120 || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
		if len(out) == maxItems {
			break
		}
	}
	return out
}

func (h Handler) list(c *gin.Context, where string, args ...any) {
	user, _ := auth.UserIDFromContext(c)
	rows, err := h.db.Query(c.Request.Context(), `SELECT id, name, description, cover_url, official, COALESCE(owner_user_id::text,'')=$1, items, updated_at
		FROM playlists WHERE `+where+` ORDER BY official DESC, updated_at DESC LIMIT 300`, append([]any{user}, args...)...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "playlists_failed", "Could not load playlists")
		return
	}
	defer rows.Close()
	items := []Playlist{}
	for rows.Next() {
		var p Playlist
		if rows.Scan(&p.ID, &p.Name, &p.Description, &p.CoverURL, &p.Official, &p.Mine, &p.Items, &p.UpdatedAt) == nil {
			items = append(items, p)
		}
	}
	httpx.OK(c, gin.H{"playlists": items})
}

// GET /playlists — the church's official playlists, plus the member's own when signed in.
func (h Handler) List(c *gin.Context) {
	h.list(c, `official OR (owner_user_id IS NOT NULL AND owner_user_id::text = $1)`)
}

// POST /playlists {"name","items"}
func (h Handler) Create(c *gin.Context) { h.create(c, false) }

// POST /admin/playlists — an official playlist for everyone.
func (h Handler) CreateOfficial(c *gin.Context) { h.create(c, true) }

func (h Handler) create(c *gin.Context, official bool) {
	user, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var req body
	if c.ShouldBindJSON(&req) != nil || req.Name == nil || strings.TrimSpace(*req.Name) == "" || len(strings.TrimSpace(*req.Name)) > 80 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "Give the playlist a name (up to 80 characters)")
		return
	}
	ctx := c.Request.Context()
	if !official {
		var n int
		_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM playlists WHERE owner_user_id=$1`, user).Scan(&n)
		if n >= maxPlaylists {
			httpx.Error(c, http.StatusBadRequest, "too_many_playlists", "You can keep up to 100 playlists")
			return
		}
	}
	items := []string{}
	if req.Items != nil {
		items = cleanItems(*req.Items)
	}
	desc, cover := "", ""
	if req.Description != nil {
		desc = strings.TrimSpace(*req.Description)
	}
	if req.CoverURL != nil {
		cover = strings.TrimSpace(*req.CoverURL)
	}
	var owner any = user
	if official {
		owner = nil
	}
	p := Playlist{ID: newID(), Name: strings.TrimSpace(*req.Name), Description: desc, CoverURL: cover, Official: official, Mine: !official, Items: items}
	if err := h.db.QueryRow(ctx, `INSERT INTO playlists(id,owner_user_id,official,name,description,cover_url,items) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING updated_at`,
		p.ID, owner, official, p.Name, desc, cover, items).Scan(&p.UpdatedAt); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "playlist_failed", "Could not create the playlist")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"playlist": p})
}

// PATCH /playlists/:id — rename, describe or set the items (in order).
func (h Handler) Update(c *gin.Context) { h.update(c, false) }

// PATCH /admin/playlists/:id
func (h Handler) UpdateOfficial(c *gin.Context) { h.update(c, true) }

func (h Handler) update(c *gin.Context, official bool) {
	user, _ := auth.UserIDFromContext(c)
	var req body
	if c.ShouldBindJSON(&req) != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	if req.Name != nil && (strings.TrimSpace(*req.Name) == "" || len(strings.TrimSpace(*req.Name)) > 80) {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "Give the playlist a name (up to 80 characters)")
		return
	}
	var name, desc, cover *string
	if req.Name != nil {
		v := strings.TrimSpace(*req.Name)
		name = &v
	}
	if req.Description != nil {
		v := strings.TrimSpace(*req.Description)
		desc = &v
	}
	if req.CoverURL != nil {
		v := strings.TrimSpace(*req.CoverURL)
		cover = &v
	}
	var items []string
	if req.Items != nil {
		items = cleanItems(*req.Items)
	}
	owner := `owner_user_id::text=$6 AND NOT official`
	if official {
		owner = `official AND $6::text IS NOT NULL`
	}
	var p Playlist
	err := h.db.QueryRow(c.Request.Context(), `UPDATE playlists SET name=COALESCE($2,name), description=COALESCE($3,description), cover_url=COALESCE($4,cover_url),
		items=COALESCE($5,items), updated_at=now() WHERE id=$1 AND `+owner+`
		RETURNING id,name,description,cover_url,official,items,updated_at`, c.Param("id"), name, desc, cover, items, user).
		Scan(&p.ID, &p.Name, &p.Description, &p.CoverURL, &p.Official, &p.Items, &p.UpdatedAt)
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "playlist_not_found", "Playlist not found")
		return
	}
	p.Mine = !p.Official
	httpx.OK(c, gin.H{"playlist": p})
}

// DELETE /playlists/:id
func (h Handler) Delete(c *gin.Context) { h.remove(c, `owner_user_id::text=$2 AND NOT official`) }

// DELETE /admin/playlists/:id
func (h Handler) DeleteOfficial(c *gin.Context) { h.remove(c, `official AND $2::text IS NOT NULL`) }

func (h Handler) remove(c *gin.Context, owner string) {
	user, _ := auth.UserIDFromContext(c)
	tag, err := h.db.Exec(c.Request.Context(), `DELETE FROM playlists WHERE id=$1 AND `+owner, c.Param("id"), user)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "playlist_not_found", "Playlist not found")
		return
	}
	httpx.OK(c, gin.H{"message": "Playlist deleted"})
}

// GET /admin/playlists — the official playlists, for staff.
func (h Handler) ListOfficial(c *gin.Context) { h.list(c, `official`) }
