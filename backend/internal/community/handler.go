package community

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/ariga/shekinah-backend/internal/permissions"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/net/websocket"
)

type Handler struct {
	db      *pgxpool.Pool
	liveHub *liveHub
	perms   permissions.Checker
}

type CreateMessageRequest struct {
	Channel string `json:"channel"`
	Message string `json:"message"`
	ReplyTo string `json:"replyTo"`
}

// The message being replied to, quoted above the reply.
type Quote struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Message     string `json:"message"`
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
	ReplyTo      *Quote `json:"replyTo,omitempty"`
	Pinned       bool   `json:"pinned,omitempty"`
	// "host" or "moderator" on live chat.
	Badge string `json:"badge,omitempty"`
}

type liveEvent struct {
	Type    string   `json:"type"`
	Active  bool     `json:"active,omitempty"`
	Message *Message `json:"message,omitempty"`
	// For "hide" and "unpin" events.
	ID string `json:"id,omitempty"`
}

type liveHub struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]struct{}
}

func NewHandler(db *pgxpool.Pool, perms permissions.Checker) Handler {
	return Handler{
		db:      db,
		liveHub: newLiveHub(),
		perms:   perms,
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
	var replyID, replyName, replyText *string

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
		&item.Pinned,
		&item.Badge,
		&replyID,
		&replyName,
		&replyText,
	)
	if err != nil {
		return Message{}, err
	}

	if replyID != nil && *replyID != "" {
		item.ReplyTo = &Quote{ID: *replyID, DisplayName: deref(replyName), Message: deref(replyText)}
	}
	item.CreatedAt = formatTimestamp(createdAt)
	return item, nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
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
			u.email,
			m.pinned,
			m.badge,
			r.id,
			r.display_name,
			r.message
		FROM community_messages m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN community_messages r ON r.id = m.reply_to_id AND r.status = 'approved'
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
	if len(message) < 1 || len(message) > 2000 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "chat message must be between 1 and 2000 characters")
		return
	}
	replyTo := strings.TrimSpace(req.ReplyTo)

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
	if err == nil && time.Since(lastMessageAt) < time.Second {
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

	// Members chat like a family group: messages show at once, and admins
	// can hide one afterwards from the dashboard.
	status := "approved"

	// Live chat rules: blocked members, slow mode, banned words, and badges
	// for the host and moderators.
	badge := ""
	if channel == "live" {
		var banned bool
		_ = h.db.QueryRow(c.Request.Context(), `SELECT EXISTS (SELECT 1 FROM chat_bans WHERE user_id = $1)`, userID).Scan(&banned)
		if banned {
			httpx.Error(c, http.StatusForbidden, "chat_blocked", "a moderator has turned off chat for your account")
			return
		}
		settings := h.liveChatSettings(c)
		isStaff := h.perms.Has(c.Request.Context(), userID, permissions.LiveModerate) || h.perms.Has(c.Request.Context(), userID, permissions.LiveBroadcast)
		if !isStaff {
			if settings.ChatOff {
				httpx.Error(c, http.StatusForbidden, "chat_off", "the host has turned off chat for now")
				return
			}
			if settings.SlowModeSeconds > 0 {
				var last time.Time
				err := h.db.QueryRow(c.Request.Context(), `SELECT created_at FROM community_messages WHERE user_id = $1 AND channel = 'live' ORDER BY created_at DESC LIMIT 1`, userID).Scan(&last)
				if err == nil && time.Since(last) < time.Duration(settings.SlowModeSeconds)*time.Second {
					httpx.Error(c, http.StatusTooManyRequests, "slow_mode", "slow mode is on, please wait a moment before your next comment")
					return
				}
			}
			lower := strings.ToLower(message)
			for _, word := range settings.BannedWords {
				if word = strings.ToLower(strings.TrimSpace(word)); word != "" && strings.Contains(lower, word) {
					httpx.Error(c, http.StatusBadRequest, "filtered", "your comment wasn't posted because it contains words not allowed in this chat")
					return
				}
			}
		}
		var hostID string
		_ = h.db.QueryRow(c.Request.Context(), `SELECT COALESCE(broadcaster_id::text, '') FROM live_sessions WHERE status IN ('starting','live') ORDER BY created_at DESC LIMIT 1`).Scan(&hostID)
		if hostID == userID {
			badge = "host"
		} else if h.perms.Has(c.Request.Context(), userID, permissions.LiveModerate) {
			badge = "moderator"
		}
	}

	item, err := scanMessage(
		h.db.QueryRow(
			c.Request.Context(),
			`
				WITH inserted AS (
					INSERT INTO community_messages (id, user_id, channel, display_name, message, status, reply_to_id, badge)
					VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8)
					RETURNING id, channel, display_name, message, status, hidden_reason, created_at, reply_to_id, pinned, badge
				)
				SELECT
					i.id, i.channel, i.display_name, i.message, i.status, i.hidden_reason, i.created_at,
					$2::text, ''::text, i.pinned, i.badge,
					r.id, r.display_name, r.message
				FROM inserted i
				LEFT JOIN community_messages r ON r.id = i.reply_to_id
			`,
			generateID("chat"),
			userID,
			channel,
			displayName,
			message,
			status,
			replyTo,
			badge,
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
			u.email,
			m.pinned,
			m.badge,
			NULL::text,
			NULL::text,
			NULL::text
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
					u.email,
					m.pinned,
					m.badge,
					NULL::text,
					NULL::text,
					NULL::text
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

type LiveChatSettings struct {
	SlowModeSeconds int      `json:"slowModeSeconds"`
	BannedWords     []string `json:"bannedWords"`
	// ChatOff: only the host and moderators can comment.
	ChatOff bool `json:"chatOff"`
}

func (h Handler) liveChatSettings(c *gin.Context) LiveChatSettings {
	var raw string
	settings := LiveChatSettings{BannedWords: []string{}}
	if err := h.db.QueryRow(c.Request.Context(), `SELECT value FROM app_settings WHERE key = 'live_chat'`).Scan(&raw); err == nil {
		_ = json.Unmarshal([]byte(raw), &settings)
	}
	if settings.BannedWords == nil {
		settings.BannedWords = []string{}
	}
	return settings
}

// GET /live/chat/status: what viewers need to know (chat off, slow mode).
func (h Handler) LiveChatStatus(c *gin.Context) {
	s := h.liveChatSettings(c)
	c.JSON(http.StatusOK, gin.H{"chatOff": s.ChatOff, "slowModeSeconds": s.SlowModeSeconds})
}

// GET /live/chat/settings (moderators)
func (h Handler) GetLiveChatSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"settings": h.liveChatSettings(c)})
}

// PUT /live/chat/settings (moderators)
func (h Handler) UpdateLiveChatSettings(c *gin.Context) {
	var req LiveChatSettings
	if err := c.ShouldBindJSON(&req); err != nil || req.SlowModeSeconds < 0 || req.SlowModeSeconds > 600 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "slow mode must be between 0 and 600 seconds")
		return
	}
	words := make([]string, 0, len(req.BannedWords))
	for _, w := range req.BannedWords {
		if w = strings.TrimSpace(w); w != "" && len(words) < 200 {
			words = append(words, w)
		}
	}
	req.BannedWords = words
	raw, _ := json.Marshal(req)
	if _, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO app_settings (key, value, updated_at) VALUES ('live_chat', $1, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, string(raw)); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "save_failed", "failed to save chat settings")
		return
	}
	c.JSON(http.StatusOK, gin.H{"settings": req})
}

// POST /live/chat/messages/:id/hide (moderators): removes a comment for everyone.
func (h Handler) ModHide(c *gin.Context) {
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE community_messages SET status = 'hidden', pinned = FALSE, hidden_reason = 'Removed by a moderator', updated_at = NOW() WHERE id = $1`, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "not_found", "message not found")
		return
	}
	h.liveHub.broadcast(liveEvent{Type: "hide", Active: true, ID: c.Param("id")})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// POST /live/chat/messages/:id/pin {"pinned": true|false} (moderators): one pinned comment at a time.
func (h Handler) ModPin(c *gin.Context) {
	var req struct {
		Pinned bool `json:"pinned"`
	}
	_ = c.ShouldBindJSON(&req)
	ctx := c.Request.Context()
	if _, err := h.db.Exec(ctx, `UPDATE community_messages SET pinned = FALSE WHERE channel = 'live' AND pinned = TRUE`); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "pin_failed", "failed to pin")
		return
	}
	if !req.Pinned {
		h.liveHub.broadcast(liveEvent{Type: "unpin", Active: true, ID: c.Param("id")})
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}
	item, err := scanMessage(h.db.QueryRow(ctx, `
		UPDATE community_messages m SET pinned = TRUE, updated_at = NOW()
		FROM users u WHERE m.id = $1 AND u.id = m.user_id AND m.status = 'approved'
		RETURNING m.id, m.channel, m.display_name, m.message, m.status, m.hidden_reason, m.created_at,
		          u.id::text, ''::text, m.pinned, m.badge, NULL::text, NULL::text, NULL::text`, c.Param("id")))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "not_found", "message not found")
		return
	}
	item.HiddenReason = ""
	h.liveHub.broadcast(liveEvent{Type: "pin", Active: true, Message: &item})
	c.JSON(http.StatusOK, gin.H{"message": item})
}

// POST /live/chat/bans {"userId": "...", "reason": "..."} (moderators): stop a member chatting
// and remove their live comments.
func (h Handler) ModBan(c *gin.Context) {
	var req struct {
		UserID string `json:"userId"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.UserID) == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "userId is required")
		return
	}
	moderator, _ := auth.UserIDFromContext(c)
	if req.UserID == moderator || h.perms.Has(c.Request.Context(), req.UserID, permissions.LiveModerate) {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "moderators and hosts can't be blocked here")
		return
	}
	ctx := c.Request.Context()
	if _, err := h.db.Exec(ctx, `INSERT INTO chat_bans (user_id, banned_by, reason) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by, created_at = NOW()`, req.UserID, moderator, strings.TrimSpace(req.Reason)); err != nil {
		httpx.Error(c, http.StatusNotFound, "not_found", "member not found")
		return
	}
	rows, _ := h.db.Query(ctx, `UPDATE community_messages SET status = 'hidden', pinned = FALSE, hidden_reason = 'Member blocked', updated_at = NOW() WHERE user_id = $1 AND channel = 'live' AND status = 'approved' RETURNING id`, req.UserID)
	if rows != nil {
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil {
				h.liveHub.broadcast(liveEvent{Type: "hide", Active: true, ID: id})
			}
		}
		rows.Close()
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DELETE /live/chat/bans/:userId (moderators)
func (h Handler) ModUnban(c *gin.Context) {
	_, _ = h.db.Exec(c.Request.Context(), `DELETE FROM chat_bans WHERE user_id = $1`, c.Param("userId"))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GET /live/chat/bans (moderators)
func (h Handler) ModBans(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `SELECT b.user_id::text, u.name, b.reason, b.created_at FROM chat_bans b JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "list_failed", "failed to load blocked members")
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, name, reason string
		var at time.Time
		if rows.Scan(&id, &name, &reason, &at) == nil {
			items = append(items, gin.H{"userId": id, "name": name, "reason": reason, "createdAt": formatTimestamp(at)})
		}
	}
	c.JSON(http.StatusOK, gin.H{"bans": items})
}

// CloseLive tells connected viewers the live chat has ended.
func (h Handler) CloseLive() {
	h.liveHub.broadcast(liveEvent{Type: "inactive", Active: false})
}
