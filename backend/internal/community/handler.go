package community

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/net/websocket"
)

type Handler struct {
	db      *pgxpool.Pool
	liveHub *liveHub
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

type liveEvent struct {
	Type    string   `json:"type"`
	Active  bool     `json:"active,omitempty"`
	Message *Message `json:"message,omitempty"`
}

type liveHub struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]struct{}
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{
		db:      db,
		liveHub: newLiveHub(),
	}
}

func newLiveHub() *liveHub {
	return &liveHub{
		clients: make(map[*websocket.Conn]struct{}),
	}
}

func (h *liveHub) add(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = struct{}{}
}

func (h *liveHub) remove(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, conn)
}

func (h *liveHub) broadcast(event liveEvent) {
	h.mu.Lock()
	clients := make([]*websocket.Conn, 0, len(h.clients))
	for conn := range h.clients {
		clients = append(clients, conn)
	}
	h.mu.Unlock()

	for _, conn := range clients {
		if err := websocket.JSON.Send(conn, event); err != nil {
			_ = conn.Close()
			h.remove(conn)
		}
	}
}

func (h *liveHub) closeAll() {
	h.mu.Lock()
	clients := make([]*websocket.Conn, 0, len(h.clients))
	for conn := range h.clients {
		clients = append(clients, conn)
	}
	h.clients = make(map[*websocket.Conn]struct{})
	h.mu.Unlock()

	for _, conn := range clients {
		_ = conn.Close()
	}
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

func cleanOrder(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "asc":
		return "ASC"
	default:
		return "DESC"
	}
}

func formatTimestamp(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

func generateID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func (h Handler) liveChatActive(ctx *gin.Context) (bool, error) {
	var isLive bool
	err := h.db.QueryRow(
		ctx.Request.Context(),
		`
			SELECT is_live
			FROM live_stream_config
			ORDER BY updated_at DESC
			LIMIT 1
		`,
	).Scan(&isLive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return isLive, nil
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
	order := cleanOrder(c.Query("order"))
	sinceRaw := strings.TrimSpace(c.Query("since"))
	active := true

	if channel == "live" {
		liveActive, err := h.liveChatActive(c)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "community_list_failed", "failed to load live chat state")
			return
		}
		active = liveActive
		if !active {
			httpx.OK(c, gin.H{
				"channel":  channel,
				"active":   false,
				"messages": []Message{},
			})
			return
		}
	}

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
		WHERE m.channel = $1
		  AND m.status = 'approved'
	`
	args := []any{channel}
	if sinceRaw != "" {
		since, err := time.Parse(time.RFC3339, sinceRaw)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "invalid since timestamp")
			return
		}
		query += ` AND m.created_at > $2`
		args = append(args, since.UTC())
	}
	query += ` ORDER BY m.created_at ` + order
	query += ` LIMIT $` + strconv.Itoa(len(args)+1)
	args = append(args, limit)

	rows, err := h.db.Query(c.Request.Context(), query, args...)
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
		item.UserEmail = ""
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_list_failed", "failed to load chat messages")
		return
	}

	httpx.OK(c, gin.H{
		"channel":  channel,
		"active":   active,
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

	if channel == "live" {
		active, err := h.liveChatActive(c)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "community_create_failed", "failed to validate live chat")
			return
		}
		if !active {
			httpx.Error(c, http.StatusConflict, "live_chat_inactive", "live chat is only available during an active live stream")
			return
		}
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

	status := "pending"
	if channel == "live" {
		status = "approved"
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
					user_id,
					channel,
					display_name,
					message,
					status
				)
				VALUES ($1, $2, $3, $4, $5, $6)
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
			status,
		),
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_create_failed", "failed to create chat message")
		return
	}

	item.UserEmail = ""
	item.HiddenReason = ""

	if channel == "live" && item.Status == "approved" && h.liveHub != nil {
		broadcastItem := item
		h.liveHub.broadcast(liveEvent{
			Type:    "message",
			Active:  true,
			Message: &broadcastItem,
		})
	}

	httpx.Created(c, gin.H{
		"message": item,
	})
}

func (h Handler) LiveStream(c *gin.Context) {
	active, err := h.liveChatActive(c)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "community_live_stream_failed", "failed to load live chat state")
		return
	}
	if !active {
		httpx.Error(c, http.StatusConflict, "live_chat_inactive", "live chat is only available during an active live stream")
		return
	}

	websocket.Handler(func(conn *websocket.Conn) {
		if h.liveHub == nil {
			_ = conn.Close()
			return
		}

		h.liveHub.add(conn)
		defer func() {
			h.liveHub.remove(conn)
			_ = conn.Close()
		}()

		_ = websocket.JSON.Send(conn, liveEvent{
			Type:   "ready",
			Active: true,
		})

		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			liveActive, checkErr := h.liveChatActive(c)
			if checkErr != nil || !liveActive {
				_ = websocket.JSON.Send(conn, liveEvent{
					Type:   "inactive",
					Active: false,
				})
				return
			}

			if err := websocket.JSON.Send(conn, liveEvent{
				Type:   "heartbeat",
				Active: true,
			}); err != nil {
				return
			}
		}
	}).ServeHTTP(c.Writer, c.Request)
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

	hiddenReason := strings.TrimSpace(req.HiddenReason)
	if status != "hidden" {
		hiddenReason = ""
	}
	if len(hiddenReason) > 500 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "hidden reason must be 500 characters or fewer")
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
			hiddenReason,
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
