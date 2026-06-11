package community

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

type CreateMessageRequest struct {
	Channel string `json:"channel"`
	Message string `json:"message"`
}

type UpdateMessageRequest struct {
	Status       string `json:"status"`
	HiddenReason string `json:"hiddenReason"`
}

type Message struct {
	ID           string `json:"id"`
	Channel      string `json:"channel"`
	DisplayName  string `json:"displayName"`
	Message      string `json:"message"`
	Status       string `json:"status"`
	HiddenReason string `json:"hiddenReason,omitempty"`
	CreatedAt    string `json:"createdAt"`
	UserID       string `json:"userId,omitempty"`
	UserEmail    string `json:"userEmail,omitempty"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func cleanChannel(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "live":
		return "live"
	default:
		return "global"
	}
}

func cleanStatus(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "approved", "pending", "hidden":
		return strings.TrimSpace(strings.ToLower(value))
	default:
		return ""
	}
}

func formatTimestamp(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

func generateID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func (h Handler) userIdentity(ctx *gin.Context, userID string) (string, string, error) {
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
		return "", "", err
	}

	return strings.TrimSpace(name), strings.TrimSpace(email), nil
}

func scanMessage(row interface{ Scan(dest ...any) error }) (Message, error) {
	var item Message
	var createdAt time.Time

	err := row.Scan(
		&item.ID,
		&item.Channel,
		&item.DisplayName,
		&item.Message,
		&item.Status,
		&item.HiddenReason,
		&createdAt,
		&item.UserID,
		&item.UserEmail,
	)
	if err != nil {
		return Message{}, err
	}

	item.CreatedAt = formatTimestamp(createdAt)
	return item, nil
}

func (h Handler) List(c *gin.Context) {
	channel := cleanChannel(c.Query("channel"))
	limit := 80

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				m.id,
				m.channel,
				m.display_name,
				m.message,
				m.status,
				m.hidden_reason,
				m.created_at,
				u.id::text,
				u.email
			FROM community_messages m
			JOIN users u ON u.id = m.user_id
			WHERE m.channel = $1
			  AND m.status = 'approved'
			ORDER BY m.created_at DESC
			LIMIT $2
		`,
		channel,
		limit,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_list_failed", "failed to load chat messages")
		return
	}
	defer rows.Close()

	items := make([]Message, 0)

	for rows.Next() {
		item, scanErr := scanMessage(rows)
		if scanErr != nil {
			httpx.Error(c, http.StatusInternalServerError, "community_list_failed", "failed to load chat messages")
			return
		}

		item.HiddenReason = ""
		item.UserID = ""
		item.UserEmail = ""
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_list_failed", "failed to load chat messages")
		return
	}

	httpx.OK(c, gin.H{
		"messages": items,
	})
}

func (h Handler) Create(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req CreateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid chat message payload")
		return
	}

	channel := cleanChannel(req.Channel)
	message := strings.TrimSpace(req.Message)
	if len(message) < 2 || len(message) > 280 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "chat message must be between 2 and 280 characters")
		return
	}

	var lastMessageAt time.Time
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT created_at
			FROM community_messages
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT 1
		`,
		userID,
	).Scan(&lastMessageAt)
	if err == nil && time.Since(lastMessageAt) < 10*time.Second {
		httpx.Error(c, http.StatusTooManyRequests, "rate_limited", "please wait a few seconds before sending another message")
		return
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(c, http.StatusInternalServerError, "community_create_failed", "failed to create chat message")
		return
	}

	displayName, _, err := h.userIdentity(c, userID)
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "active user not found")
		return
	}

	item, err := scanMessage(
		h.db.QueryRow(
			c.Request.Context(),
			`
				INSERT INTO community_messages (
					id,
					user_id,
					channel,
					display_name,
					message,
					status
				)
				VALUES ($1, $2, $3, $4, $5, 'approved')
				RETURNING
					id,
					channel,
					display_name,
					message,
					status,
					hidden_reason,
					created_at,
					$2::text,
					''::text
			`,
			generateID("chat"),
			userID,
			channel,
			displayName,
			message,
		),
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_create_failed", "failed to create chat message")
		return
	}

	item.UserID = ""
	item.UserEmail = ""
	item.HiddenReason = ""

	httpx.Created(c, gin.H{
		"message": item,
	})
}

func (h Handler) AdminList(c *gin.Context) {
	channel := cleanChannel(c.Query("channel"))
	status := cleanStatus(c.Query("status"))

	query := `
		SELECT
			m.id,
			m.channel,
			m.display_name,
			m.message,
			m.status,
			m.hidden_reason,
			m.created_at,
			u.id::text,
			u.email
		FROM community_messages m
		JOIN users u ON u.id = m.user_id
		WHERE ($1 = '' OR m.channel = $1)
		  AND ($2 = '' OR m.status = $2)
		ORDER BY m.created_at DESC
		LIMIT 250
	`

	if c.Query("channel") == "" {
		channel = ""
	}

	rows, err := h.db.Query(c.Request.Context(), query, channel, status)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_admin_list_failed", "failed to load admin chat queue")
		return
	}
	defer rows.Close()

	items := make([]Message, 0)
	for rows.Next() {
		item, scanErr := scanMessage(rows)
		if scanErr != nil {
			httpx.Error(c, http.StatusInternalServerError, "community_admin_list_failed", "failed to load admin chat queue")
			return
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_admin_list_failed", "failed to load admin chat queue")
		return
	}

	httpx.OK(c, gin.H{
		"messages": items,
	})
}

func (h Handler) AdminUpdate(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid message id is required")
		return
	}

	var req UpdateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	status := cleanStatus(req.Status)
	if status == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid status is required")
		return
	}

	item, err := scanMessage(
		h.db.QueryRow(
			c.Request.Context(),
			`
				UPDATE community_messages m
				SET status = $2,
				    hidden_reason = $3,
				    updated_at = NOW()
				FROM users u
				WHERE m.id = $1
				  AND u.id = m.user_id
				RETURNING
					m.id,
					m.channel,
					m.display_name,
					m.message,
					m.status,
					m.hidden_reason,
					m.created_at,
					u.id::text,
					u.email
			`,
			id,
			status,
			strings.TrimSpace(req.HiddenReason),
		),
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "community_message_not_found", "chat message not found")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "community_admin_update_failed", "failed to update chat message")
		return
	}

	httpx.OK(c, gin.H{
		"message": item,
	})
}

func (h Handler) Delete(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid message id is required")
		return
	}

	result, err := h.db.Exec(
		c.Request.Context(),
		`DELETE FROM community_messages WHERE id = $1`,
		id,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_delete_failed", "failed to delete chat message")
		return
	}

	if result.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "community_message_not_found", "chat message not found")
		return
	}

	c.Status(http.StatusNoContent)
}
