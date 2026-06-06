package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db     *pgxpool.Pool
	client *http.Client
}

type RegisterDeviceRequest struct {
	ExpoPushToken string          `json:"expoPushToken"`
	Platform      string          `json:"platform"`
	DeviceName    string          `json:"deviceName"`
	AppVersion    string          `json:"appVersion"`
	Preferences   json.RawMessage `json:"preferences"`
}

type UpdatePreferencesRequest struct {
	ExpoPushToken string          `json:"expoPushToken"`
	Preferences   json.RawMessage `json:"preferences"`
	Enabled       *bool           `json:"enabled"`
}

type BroadcastRequest struct {
	Title    string                 `json:"title"`
	Body     string                 `json:"body"`
	Category string                 `json:"category"`
	Data     map[string]interface{} `json:"data"`
}

type expoPushMessage struct {
	To       string                 `json:"to"`
	Title    string                 `json:"title"`
	Body     string                 `json:"body"`
	Sound    string                 `json:"sound,omitempty"`
	Priority string                 `json:"priority,omitempty"`
	Data     map[string]interface{} `json:"data,omitempty"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{
		db: db,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func cleanToken(value string) string {
	return strings.TrimSpace(value)
}

func validExpoToken(value string) bool {
	token := cleanToken(value)

	return strings.HasPrefix(token, "ExponentPushToken[") ||
		strings.HasPrefix(token, "ExpoPushToken[")
}

func jsonObjectOrDefault(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`{}`)
	}

	var value map[string]interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return json.RawMessage(`{}`)
	}

	return raw
}

func newID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func (h Handler) RegisterDevice(c *gin.Context) {
	var req RegisterDeviceRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid notification device payload"})
		return
	}

	token := cleanToken(req.ExpoPushToken)
	if !validExpoToken(token) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid Expo push token is required"})
		return
	}

	preferences := jsonObjectOrDefault(req.Preferences)
	id := newID("nd")

	err := h.db.QueryRow(
		c.Request.Context(),
		`
			INSERT INTO notification_devices (
				id,
				expo_push_token,
				platform,
				device_name,
				app_version,
				preferences,
				enabled,
				created_at,
				updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE, NOW(), NOW())
			ON CONFLICT (expo_push_token)
			DO UPDATE SET
				platform = EXCLUDED.platform,
				device_name = EXCLUDED.device_name,
				app_version = EXCLUDED.app_version,
				preferences = EXCLUDED.preferences,
				enabled = TRUE,
				updated_at = NOW()
			RETURNING id
		`,
		id,
		token,
		strings.TrimSpace(req.Platform),
		strings.TrimSpace(req.DeviceName),
		strings.TrimSpace(req.AppVersion),
		string(preferences),
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to register notification device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"device": gin.H{
			"id":            id,
			"expoPushToken": token,
		},
	})
}

func (h Handler) UpdatePreferences(c *gin.Context) {
	var req UpdatePreferencesRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid notification preferences payload"})
		return
	}

	token := cleanToken(req.ExpoPushToken)
	if !validExpoToken(token) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid Expo push token is required"})
		return
	}

	preferences := jsonObjectOrDefault(req.Preferences)
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	tag, err := h.db.Exec(
		c.Request.Context(),
		`
			UPDATE notification_devices
			SET preferences = $2::jsonb,
			    enabled = $3,
			    updated_at = NOW()
			WHERE expo_push_token = $1
		`,
		token,
		string(preferences),
		enabled,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update notification preferences"})
		return
	}

	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Notification device not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h Handler) Broadcast(c *gin.Context) {
	var req BroadcastRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid broadcast payload"})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Body = strings.TrimSpace(req.Body)
	req.Category = strings.TrimSpace(req.Category)

	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Title is required"})
		return
	}

	if req.Body == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Body is required"})
		return
	}

	if req.Category == "" {
		req.Category = "general"
	}

	tokens, err := h.tokensForCategory(c.Request.Context(), req.Category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load notification devices"})
		return
	}

	success, failure := h.sendExpoPush(tokens, req)

	messageID := newID("nm")
	dataBytes, _ := json.Marshal(req.Data)
	if len(dataBytes) == 0 {
		dataBytes = []byte(`{}`)
	}

	_, _ = h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO notification_messages (
				id,
				title,
				body,
				category,
				data,
				target_count,
				success_count,
				failure_count
			)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
		`,
		messageID,
		req.Title,
		req.Body,
		req.Category,
		string(dataBytes),
		len(tokens),
		success,
		failure,
	)

	c.JSON(http.StatusOK, gin.H{
		"message": gin.H{
			"id":           messageID,
			"targetCount":  len(tokens),
			"successCount": success,
			"failureCount": failure,
		},
	})
}

func (h Handler) ListMessages(c *gin.Context) {
	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT id, title, body, category, target_count, success_count, failure_count, created_at
			FROM notification_messages
			ORDER BY created_at DESC
			LIMIT 100
		`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load notification messages"})
		return
	}
	defer rows.Close()

	messages := make([]gin.H, 0)

	for rows.Next() {
		var (
			id           string
			title        string
			body         string
			category     string
			targetCount  int
			successCount int
			failureCount int
			createdAt    time.Time
		)

		if err := rows.Scan(
			&id,
			&title,
			&body,
			&category,
			&targetCount,
			&successCount,
			&failureCount,
			&createdAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to scan notification message"})
			return
		}

		messages = append(messages, gin.H{
			"id":           id,
			"title":        title,
			"body":         body,
			"category":     category,
			"targetCount":  targetCount,
			"successCount": successCount,
			"failureCount": failureCount,
			"createdAt":    createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (h Handler) tokensForCategory(ctx context.Context, category string) ([]string, error) {
	rows, err := h.db.Query(
		ctx,
		`
			SELECT expo_push_token
			FROM notification_devices
			WHERE enabled = TRUE
			  AND (
			    preferences = '{}'::jsonb
			    OR COALESCE((preferences ->> $1)::boolean, TRUE) = TRUE
			  )
		`,
		category,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tokens := make([]string, 0)

	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			return nil, err
		}

		if validExpoToken(token) {
			tokens = append(tokens, token)
		}
	}

	return tokens, rows.Err()
}

func (h Handler) sendExpoPush(tokens []string, req BroadcastRequest) (int, int) {
	if len(tokens) == 0 {
		return 0, 0
	}

	success := 0
	failure := 0

	for start := 0; start < len(tokens); start += 100 {
		end := start + 100
		if end > len(tokens) {
			end = len(tokens)
		}

		batch := make([]expoPushMessage, 0, end-start)

		for _, token := range tokens[start:end] {
			batch = append(batch, expoPushMessage{
				To:       token,
				Title:    req.Title,
				Body:     req.Body,
				Sound:    "default",
				Priority: "high",
				Data: map[string]interface{}{
					"category": req.Category,
					"payload":  req.Data,
				},
			})
		}

		payload, _ := json.Marshal(batch)

		httpReq, err := http.NewRequest(
			http.MethodPost,
			"https://exp.host/--/api/v2/push/send",
			bytes.NewReader(payload),
		)
		if err != nil {
			failure += len(batch)
			continue
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Accept", "application/json")

		resp, err := h.client.Do(httpReq)
		if err != nil {
			failure += len(batch)
			continue
		}

		if resp.Body != nil {
			_ = resp.Body.Close()
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			success += len(batch)
		} else {
			failure += len(batch)
		}
	}

	return success, failure
}
