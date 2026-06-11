package testimonies

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

type Testimony struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Body        string `json:"body"`
	Status      string `json:"status"`
	Featured    bool   `json:"featured"`
	LikeCount   int    `json:"likeCount"`
	DisplayName string `json:"displayName"`
	OwnerEmail  string `json:"ownerEmail,omitempty"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type CreateRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type UpdateRequest struct {
	Status   string `json:"status"`
	Featured *bool  `json:"featured"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func testimonyID() string {
	return "testimony-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func cleanStatus(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "pending", "approved", "rejected":
		return strings.TrimSpace(strings.ToLower(value))
	default:
		return ""
	}
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

func scanTestimony(row interface{ Scan(dest ...any) error }) (Testimony, error) {
	var item Testimony
	var createdAt time.Time
	var updatedAt time.Time

	err := row.Scan(
		&item.ID,
		&item.Title,
		&item.Body,
		&item.Status,
		&item.Featured,
		&item.LikeCount,
		&item.DisplayName,
		&item.OwnerEmail,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return Testimony{}, err
	}

	item.CreatedAt = formatTime(createdAt)
	item.UpdatedAt = formatTime(updatedAt)
	return item, nil
}

func (h Handler) List(c *gin.Context) {
	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				t.id,
				t.title,
				t.body,
				t.status,
				t.featured,
				t.like_count,
				COALESCE(NULLIF(TRIM(u.name), ''), 'Shekinah Member') AS display_name,
				''::text AS owner_email,
				t.created_at,
				t.updated_at
			FROM testimonies t
			JOIN users u ON u.id = t.user_id
			WHERE t.status = 'approved'
			ORDER BY t.featured DESC, t.created_at DESC
			LIMIT 120
		`,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_list_failed", "failed to load testimonies")
		return
	}
	defer rows.Close()

	items := make([]Testimony, 0)
	for rows.Next() {
		item, scanErr := scanTestimony(rows)
		if scanErr != nil {
			httpx.Error(c, http.StatusInternalServerError, "testimony_list_failed", "failed to load testimonies")
			return
		}
		item.OwnerEmail = ""
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_list_failed", "failed to load testimonies")
		return
	}

	httpx.OK(c, gin.H{"testimonies": items})
}

func (h Handler) ListMine(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				t.id,
				t.title,
				t.body,
				t.status,
				t.featured,
				t.like_count,
				COALESCE(NULLIF(TRIM(u.name), ''), 'Shekinah Member') AS display_name,
				u.email,
				t.created_at,
				t.updated_at
			FROM testimonies t
			JOIN users u ON u.id = t.user_id
			WHERE t.user_id = $1
			ORDER BY t.created_at DESC
			LIMIT 120
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_list_failed", "failed to load testimonies")
		return
	}
	defer rows.Close()

	items := make([]Testimony, 0)
	for rows.Next() {
		item, scanErr := scanTestimony(rows)
		if scanErr != nil {
			httpx.Error(c, http.StatusInternalServerError, "testimony_list_failed", "failed to load testimonies")
			return
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_list_failed", "failed to load testimonies")
		return
	}

	httpx.OK(c, gin.H{"testimonies": items})
}

func (h Handler) Create(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid testimony payload")
		return
	}

	title := strings.TrimSpace(req.Title)
	body := strings.TrimSpace(req.Body)

	if len(title) < 4 || len(title) > 120 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "title must be between 4 and 120 characters")
		return
	}

	if len(body) < 20 || len(body) > 4000 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "testimony must be between 20 and 4000 characters")
		return
	}

	item, err := scanTestimony(
		h.db.QueryRow(
			c.Request.Context(),
			`
				INSERT INTO testimonies (
					id,
					user_id,
					title,
					body,
					status
				)
				VALUES ($1, $2, $3, $4, 'pending')
				RETURNING
					id,
					title,
					body,
					status,
					featured,
					like_count,
					'Shekinah Member'::text,
					''::text,
					created_at,
					updated_at
			`,
			testimonyID(),
			userID,
			title,
			body,
		),
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_create_failed", "failed to submit testimony")
		return
	}

	httpx.Created(c, gin.H{"testimony": item})
}

func (h Handler) Like(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid testimony id is required")
		return
	}

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_like_failed", "failed to like testimony")
		return
	}
	defer tx.Rollback(c.Request.Context())

	_, err = tx.Exec(
		c.Request.Context(),
		`
			INSERT INTO testimony_likes (id, testimony_id, user_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (testimony_id, user_id) DO NOTHING
		`,
		"tlike-"+strconv.FormatInt(time.Now().UnixNano(), 36),
		id,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_like_failed", "failed to like testimony")
		return
	}

	var likeCount int
	err = tx.QueryRow(
		c.Request.Context(),
		`
			UPDATE testimonies
			SET like_count = (
				SELECT COUNT(*) FROM testimony_likes WHERE testimony_id = $1
			),
			    updated_at = NOW()
			WHERE id = $1
			  AND status = 'approved'
			RETURNING like_count
		`,
		id,
	).Scan(&likeCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "testimony_not_found", "testimony not found")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "testimony_like_failed", "failed to like testimony")
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_like_failed", "failed to like testimony")
		return
	}

	httpx.OK(c, gin.H{"id": id, "likeCount": likeCount})
}

func (h Handler) AdminList(c *gin.Context) {
	status := cleanStatus(c.Query("status"))
	query := `
		SELECT
			t.id,
			t.title,
			t.body,
			t.status,
			t.featured,
			t.like_count,
			COALESCE(NULLIF(TRIM(u.name), ''), 'Shekinah Member') AS display_name,
			u.email,
			t.created_at,
			t.updated_at
		FROM testimonies t
		JOIN users u ON u.id = t.user_id
		WHERE ($1 = '' OR t.status = $1)
		ORDER BY t.featured DESC, t.created_at DESC
		LIMIT 250
	`

	rows, err := h.db.Query(c.Request.Context(), query, status)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_admin_list_failed", "failed to load testimonies")
		return
	}
	defer rows.Close()

	items := make([]Testimony, 0)
	for rows.Next() {
		item, scanErr := scanTestimony(rows)
		if scanErr != nil {
			httpx.Error(c, http.StatusInternalServerError, "testimony_admin_list_failed", "failed to load testimonies")
			return
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "testimony_admin_list_failed", "failed to load testimonies")
		return
	}

	httpx.OK(c, gin.H{"testimonies": items})
}

func (h Handler) AdminUpdate(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid testimony id is required")
		return
	}

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	status := cleanStatus(req.Status)
	if status == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid status is required")
		return
	}

	featured := false
	if req.Featured != nil {
		featured = *req.Featured
	}

	item, err := scanTestimony(
		h.db.QueryRow(
			c.Request.Context(),
			`
				UPDATE testimonies t
				SET status = $2,
				    featured = $3,
				    approved_at = CASE WHEN $2 = 'approved' THEN COALESCE(t.approved_at, NOW()) ELSE NULL END,
				    updated_at = NOW()
				FROM users u
				WHERE t.id = $1
				  AND u.id = t.user_id
				RETURNING
					t.id,
					t.title,
					t.body,
					t.status,
					t.featured,
					t.like_count,
					COALESCE(NULLIF(TRIM(u.name), ''), 'Shekinah Member') AS display_name,
					u.email,
					t.created_at,
					t.updated_at
			`,
			id,
			status,
			featured,
		),
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "testimony_not_found", "testimony not found")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "testimony_admin_update_failed", "failed to update testimony")
		return
	}

	httpx.OK(c, gin.H{"testimony": item})
}
