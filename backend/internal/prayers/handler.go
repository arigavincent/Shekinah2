package prayers

import (
	"errors"
	"fmt"
	"net/http"
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

type CreatePrayerRequest struct {
	Category  string `json:"category"`
	Text      string `json:"text"`
	IsPublic  *bool  `json:"isPublic"`
	Anonymous *bool  `json:"anonymous"`
}

type Prayer struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Text     string `json:"text"`
	Date     string `json:"date"`
	Count    int    `json:"count"`
	Category string `json:"category"`
	IsPublic bool   `json:"isPublic"`
	Status   string `json:"status"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func formatPrayerDate(t time.Time) string {
	now := time.Now().UTC()
	created := t.UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	target := time.Date(created.Year(), created.Month(), created.Day(), 0, 0, 0, 0, time.UTC)

	switch {
	case target.Equal(today):
		return "Today"
	case target.Equal(today.AddDate(0, 0, -1)):
		return "Yesterday"
	default:
		return created.Format("January 2, 2006")
	}
}

func cleanPrayerCategory(value string) string {
	category := strings.TrimSpace(value)
	if category == "" {
		return "Personal"
	}

	return category
}

func (h Handler) userNameAndEmail(ctx *gin.Context, userID string) (string, string, error) {
	var name string
	var email string

	err := h.db.QueryRow(
		ctx.Request.Context(),
		`
			SELECT name, email
			FROM users
			WHERE id = $1
			  AND is_active = TRUE
		`,
		userID,
	).Scan(&name, &email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", fmt.Errorf("active user not found")
		}

		return "", "", err
	}

	return strings.TrimSpace(name), strings.TrimSpace(email), nil
}

func scanPrayer(row pgx.Row) (Prayer, error) {
	var item Prayer
	var createdAt time.Time

	err := row.Scan(
		&item.ID,
		&item.Name,
		&item.Text,
		&createdAt,
		&item.Count,
		&item.Category,
		&item.IsPublic,
		&item.Status,
	)
	if err != nil {
		return Prayer{}, err
	}

	item.Date = formatPrayerDate(createdAt)
	return item, nil
}

func (h Handler) ListPublic(c *gin.Context) {
	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT id, name, text, created_at, count, category, is_public, status
			FROM prayers
			WHERE is_public = TRUE
			ORDER BY created_at DESC
			LIMIT 100
		`,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_list_failed", "failed to load prayer requests")
		return
	}
	defer rows.Close()

	items := make([]Prayer, 0)

	for rows.Next() {
		var item Prayer
		var createdAt time.Time

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Text,
			&createdAt,
			&item.Count,
			&item.Category,
			&item.IsPublic,
			&item.Status,
		); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "prayer_list_failed", "failed to load prayer requests")
			return
		}

		item.Date = formatPrayerDate(createdAt)
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_list_failed", "failed to load prayer requests")
		return
	}

	httpx.OK(c, gin.H{
		"prayers": items,
	})
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
			SELECT id, name, text, created_at, count, category, is_public, status
			FROM prayers
			WHERE owner_user_id = $1
			ORDER BY created_at DESC
			LIMIT 100
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_list_failed", "failed to load your prayer requests")
		return
	}
	defer rows.Close()

	items := make([]Prayer, 0)

	for rows.Next() {
		var item Prayer
		var createdAt time.Time

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Text,
			&createdAt,
			&item.Count,
			&item.Category,
			&item.IsPublic,
			&item.Status,
		); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "prayer_list_failed", "failed to load your prayer requests")
			return
		}

		item.Date = formatPrayerDate(createdAt)
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_list_failed", "failed to load your prayer requests")
		return
	}

	httpx.OK(c, gin.H{
		"prayers": items,
	})
}

func (h Handler) Create(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req CreatePrayerRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid prayer request payload")
		return
	}

	text := strings.TrimSpace(req.Text)
	if len(text) < 10 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "prayer request must be at least 10 characters")
		return
	}

	category := cleanPrayerCategory(req.Category)
	isPublic := true
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}

	anonymous := false
	if req.Anonymous != nil {
		anonymous = *req.Anonymous
	}

	userName, userEmail, err := h.userNameAndEmail(c, userID)
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "active user not found")
		return
	}

	name := userName
	if anonymous {
		name = "Anonymous"
	}

	id := fmt.Sprintf("pr-%d", time.Now().UnixNano())
	createdAt := time.Now().UTC()

	prayer, err := scanPrayer(h.db.QueryRow(
		c.Request.Context(),
		`
			INSERT INTO prayers (
				id,
				name,
				text,
				prayer_date,
				count,
				category,
				is_public,
				owner_user_id,
				owner_email,
				created_at,
				updated_at
			)
			VALUES ($1, $2, $3, 'Today', 0, $4, $5, $6, $7, $8, $8)
			RETURNING id, name, text, created_at, count, category, is_public, status
		`,
		id,
		name,
		text,
		category,
		isPublic,
		userID,
		userEmail,
		createdAt,
	))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_create_failed", "failed to save prayer request")
		return
	}

	httpx.Created(c, gin.H{
		"prayer": prayer,
	})
}

func (h Handler) Pray(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	prayerID := strings.TrimSpace(c.Param("id"))
	if prayerID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "prayer request id is required")
		return
	}

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_update_failed", "failed to record prayer support")
		return
	}
	defer tx.Rollback(c.Request.Context())

	tag, err := tx.Exec(
		c.Request.Context(),
		`
			INSERT INTO prayer_prays (prayer_id, user_id)
			SELECT p.id, $2
			FROM prayers p
			WHERE p.id = $1
			  AND p.is_public = TRUE
			ON CONFLICT DO NOTHING
		`,
		prayerID,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_update_failed", "failed to record prayer support")
		return
	}

	prayed := tag.RowsAffected() > 0
	if prayed {
		if _, err := tx.Exec(
			c.Request.Context(),
			`
				UPDATE prayers
				SET count = count + 1,
				    updated_at = NOW()
				WHERE id = $1
			`,
			prayerID,
		); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "prayer_update_failed", "failed to update prayer count")
			return
		}
	}

	prayer, err := scanPrayer(tx.QueryRow(
		c.Request.Context(),
		`
			SELECT id, name, text, created_at, count, category, is_public, status
			FROM prayers
			WHERE id = $1
			  AND is_public = TRUE
		`,
		prayerID,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "not_found", "prayer request not found")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "prayer_update_failed", "failed to load prayer request")
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "prayer_update_failed", "failed to record prayer support")
		return
	}

	httpx.OK(c, gin.H{
		"prayed": prayed,
		"prayer": prayer,
	})
}
