package library

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

type Item struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Author        string `json:"author"`
	Category      string `json:"category"`
	CoverURL      string `json:"coverUrl"`
	FileURL       string `json:"fileUrl"`
	FileType      string `json:"fileType"`
	FileSizeBytes int64  `json:"fileSizeBytes"`
	IsFeatured    bool   `json:"isFeatured"`
	PublishedAt   string `json:"publishedAt"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func formatItem(row interface{ Scan(dest ...any) error }) (Item, error) {
	var item Item
	var publishedAt time.Time
	if err := row.Scan(
		&item.ID,
		&item.Title,
		&item.Description,
		&item.Author,
		&item.Category,
		&item.CoverURL,
		&item.FileURL,
		&item.FileType,
		&item.FileSizeBytes,
		&item.IsFeatured,
		&publishedAt,
	); err != nil {
		return Item{}, err
	}

	item.PublishedAt = publishedAt.UTC().Format(time.RFC3339)
	return item, nil
}

func (h Handler) List(c *gin.Context) {
	queryText := strings.TrimSpace(strings.ToLower(c.Query("q")))
	category := strings.TrimSpace(strings.ToLower(c.Query("category")))

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				id,
				title,
				description,
				author,
				category,
				cover_url,
				file_url,
				file_type,
				file_size_bytes,
				is_featured,
				published_at
			FROM library_items
			WHERE published_at <= NOW()
			  AND ($1 = '' OR LOWER(title || ' ' || description || ' ' || author || ' ' || category) LIKE '%' || $1 || '%')
			  AND ($2 = '' OR LOWER(category) = $2)
			ORDER BY is_featured DESC, published_at DESC, created_at DESC
			LIMIT 200
		`,
		queryText,
		category,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "library_list_failed", "failed to load library resources")
		return
	}
	defer rows.Close()

	items := make([]Item, 0)
	for rows.Next() {
		item, err := formatItem(rows)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "library_list_failed", "failed to load library resources")
			return
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "library_list_failed", "failed to load library resources")
		return
	}

	httpx.OK(c, gin.H{"items": items})
}

func (h Handler) Detail(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid library item id is required")
		return
	}

	item, err := formatItem(h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT
				id,
				title,
				description,
				author,
				category,
				cover_url,
				file_url,
				file_type,
				file_size_bytes,
				is_featured,
				published_at
			FROM library_items
			WHERE id = $1
			  AND published_at <= NOW()
			LIMIT 1
		`,
		id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "library_item_not_found", "library item not found")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "library_item_failed", "failed to load library item")
		return
	}

	httpx.OK(c, gin.H{"item": item})
}
