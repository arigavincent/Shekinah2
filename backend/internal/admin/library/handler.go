package library

import (
	"context"
	"errors"
	"net/http"
	"strconv"
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
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Author        string    `json:"author"`
	Category      string    `json:"category"`
	CoverURL      string    `json:"coverUrl"`
	FileURL       string    `json:"fileUrl"`
	FileType      string    `json:"fileType"`
	FileSizeBytes int64     `json:"fileSizeBytes"`
	IsFeatured    bool      `json:"isFeatured"`
	PublishedAt   string    `json:"publishedAt"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type CreateRequest struct {
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

type UpdateRequest struct {
	Title         *string `json:"title"`
	Description   *string `json:"description"`
	Author        *string `json:"author"`
	Category      *string `json:"category"`
	CoverURL      *string `json:"coverUrl"`
	FileURL       *string `json:"fileUrl"`
	FileType      *string `json:"fileType"`
	FileSizeBytes *int64  `json:"fileSizeBytes"`
	IsFeatured    *bool   `json:"isFeatured"`
	PublishedAt   *string `json:"publishedAt"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func itemID() string {
	return "lib-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func parsePublishedAt(value string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Now().UTC(), nil
	}

	layouts := []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02 15:04", "2006-01-02"}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.UTC(), nil
		}
	}
	return time.Time{}, errors.New("invalid publish date")
}

func scanItem(row interface{ Scan(dest ...any) error }) (Item, error) {
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
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Item{}, err
	}

	item.PublishedAt = publishedAt.UTC().Format(time.RFC3339)
	return item, nil
}

func (h Handler) List(c *gin.Context) {
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
				published_at,
				created_at,
				updated_at
			FROM library_items
			ORDER BY published_at DESC, created_at DESC
		`,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "library_list_failed", "failed to load library resources")
		return
	}
	defer rows.Close()

	items := make([]Item, 0)
	for rows.Next() {
		item, err := scanItem(rows)
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

func (h Handler) Create(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	item, err := h.save(c.Request.Context(), "", req, nil)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}

	httpx.Created(c, gin.H{"item": item})
}

func (h Handler) Update(c *gin.Context) {
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid library item id is required")
		return
	}

	item, err := h.save(c.Request.Context(), id, CreateRequest{}, &req)
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			httpx.Error(c, http.StatusNotFound, "library_item_not_found", "library item not found")
		default:
			httpx.Error(c, http.StatusBadRequest, "invalid_input", err.Error())
		}
		return
	}

	httpx.OK(c, gin.H{"item": item})
}

func (h Handler) Delete(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid library item id is required")
		return
	}

	result, err := h.db.Exec(c.Request.Context(), `DELETE FROM library_items WHERE id = $1`, id)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "library_delete_failed", "failed to delete library item")
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "library_item_not_found", "library item not found")
		return
	}

	c.Status(http.StatusNoContent)
}

func (h Handler) save(ctx context.Context, id string, createReq CreateRequest, updateReq *UpdateRequest) (Item, error) {
	req := createReq
	if updateReq != nil {
		current, err := scanItem(h.db.QueryRow(
			ctx,
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
					published_at,
					created_at,
					updated_at
				FROM library_items
				WHERE id = $1
				LIMIT 1
			`,
			id,
		))
		if err != nil {
			return Item{}, err
		}

		req = CreateRequest{
			Title:         current.Title,
			Description:   current.Description,
			Author:        current.Author,
			Category:      current.Category,
			CoverURL:      current.CoverURL,
			FileURL:       current.FileURL,
			FileType:      current.FileType,
			FileSizeBytes: current.FileSizeBytes,
			IsFeatured:    current.IsFeatured,
			PublishedAt:   current.PublishedAt,
		}

		if updateReq.Title != nil {
			req.Title = *updateReq.Title
		}
		if updateReq.Description != nil {
			req.Description = *updateReq.Description
		}
		if updateReq.Author != nil {
			req.Author = *updateReq.Author
		}
		if updateReq.Category != nil {
			req.Category = *updateReq.Category
		}
		if updateReq.CoverURL != nil {
			req.CoverURL = *updateReq.CoverURL
		}
		if updateReq.FileURL != nil {
			req.FileURL = *updateReq.FileURL
		}
		if updateReq.FileType != nil {
			req.FileType = *updateReq.FileType
		}
		if updateReq.FileSizeBytes != nil {
			req.FileSizeBytes = *updateReq.FileSizeBytes
		}
		if updateReq.IsFeatured != nil {
			req.IsFeatured = *updateReq.IsFeatured
		}
		if updateReq.PublishedAt != nil {
			req.PublishedAt = *updateReq.PublishedAt
		}
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Author = strings.TrimSpace(req.Author)
	req.Category = strings.TrimSpace(req.Category)
	req.CoverURL = strings.TrimSpace(req.CoverURL)
	req.FileURL = strings.TrimSpace(req.FileURL)
	req.FileType = strings.TrimSpace(strings.ToLower(req.FileType))

	if req.Title == "" || req.FileURL == "" {
		return Item{}, errors.New("title and file URL are required")
	}
	if req.FileType == "" {
		req.FileType = "pdf"
	}
	if req.FileType != "pdf" {
		return Item{}, errors.New("only PDF resources are supported in this release")
	}

	publishedAt, err := parsePublishedAt(req.PublishedAt)
	if err != nil {
		return Item{}, err
	}

	if id == "" {
		id = itemID()
		_, err = h.db.Exec(
			ctx,
			`
				INSERT INTO library_items (
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
				)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			`,
			id,
			req.Title,
			req.Description,
			req.Author,
			req.Category,
			req.CoverURL,
			req.FileURL,
			req.FileType,
			req.FileSizeBytes,
			req.IsFeatured,
			publishedAt,
		)
	} else {
		_, err = h.db.Exec(
			ctx,
			`
				UPDATE library_items
				SET
					title = $2,
					description = $3,
					author = $4,
					category = $5,
					cover_url = $6,
					file_url = $7,
					file_type = $8,
					file_size_bytes = $9,
					is_featured = $10,
					published_at = $11,
					updated_at = NOW()
				WHERE id = $1
			`,
			id,
			req.Title,
			req.Description,
			req.Author,
			req.Category,
			req.CoverURL,
			req.FileURL,
			req.FileType,
			req.FileSizeBytes,
			req.IsFeatured,
			publishedAt,
		)
	}
	if err != nil {
		return Item{}, err
	}

	return scanItem(h.db.QueryRow(
		ctx,
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
				published_at,
				created_at,
				updated_at
			FROM library_items
			WHERE id = $1
		`,
		id,
	))
}
