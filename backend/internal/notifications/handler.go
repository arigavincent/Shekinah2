package notifications

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/integrations"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	store   *integrations.Store
	runtime *senderCache
	db      *pgxpool.Pool
	client  *http.Client
	fcm     *fcmSender
}

type RegisterDeviceRequest struct {
	ExpoPushToken string `json:"expoPushToken"`
	// "fcm" for the native Android app; empty means the Expo app.
	Provider    string          `json:"provider"`
	Platform    string          `json:"platform"`
	DeviceName  string          `json:"deviceName"`
	AppVersion  string          `json:"appVersion"`
	Preferences json.RawMessage `json:"preferences"`
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
	// Set by staff messaging: only these members (nil = everyone).
	UserIDs       []string `json:"-"`
	AudienceLabel string   `json:"-"`
	SentBy        string   `json:"-"`
	Channels      []string `json:"-"`
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
	client := &http.Client{Timeout: 15 * time.Second}
	return Handler{db: db, client: client, fcm: newFCMSender(client)}
}

type senderCache struct {
	sync.Mutex
	hash   [32]byte
	sender *fcmSender
}

func (h Handler) WithIntegrations(store integrations.Store) Handler {
	h.store = &store
	h.runtime = &senderCache{}
	return h
}
func (h Handler) currentSender(ctx context.Context) *fcmSender {
	if h.store == nil {
		return h.fcm
	}
	cfg, _, err := h.store.Load(ctx, "firebase")
	if err != nil || !cfg.Enabled {
		return nil
	}
	raw := cfg.Values["FCM_SERVICE_ACCOUNT_JSON"]
	hash := sha256.Sum256([]byte(raw))
	h.runtime.Lock()
	defer h.runtime.Unlock()
	if h.runtime.sender == nil || h.runtime.hash != hash {
		h.runtime.hash = hash
		h.runtime.sender = senderFromJSON(h.client, raw)
	}
	return h.runtime.sender
}
func cleanToken(value string) string {
	return strings.TrimSpace(value)
}

// FCM registration tokens are long opaque strings.
func validDeviceToken(value string) bool {
	token := cleanToken(value)
	return validExpoToken(token) || (len(token) >= 60 && len(token) <= 4096 && !strings.ContainsAny(token, " \n"))
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
	provider := "expo"
	if strings.EqualFold(strings.TrimSpace(req.Provider), "fcm") {
		provider = "fcm"
	}
	if (provider == "expo" && !validExpoToken(token)) || (provider == "fcm" && !validDeviceToken(token)) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid push token is required"})
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
				provider,
				user_id,
				created_at,
				updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE, $7, NULLIF($8, '')::uuid, NOW(), NOW())
			ON CONFLICT (expo_push_token)
			DO UPDATE SET
				provider = EXCLUDED.provider,
				user_id = EXCLUDED.user_id,
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
		provider,
		signedIn(c),
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
	if !validDeviceToken(token) {
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

	result, err := h.Notify(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load notification devices"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": result})
}

// Notify sends a message to every device that wants its category and
// records it (the app's feed shows it too). Used by the dashboard broadcast
// and by features such as going live.
func (h Handler) Notify(ctx context.Context, req BroadcastRequest) (gin.H, error) {
	if req.Category == "" {
		req.Category = "general"
	}
	tokens, fcmTokens, err := h.tokensForCategory(ctx, req.Category, req.UserIDs)
	if err != nil {
		return nil, err
	}

	success, failure, fcmSuccess, fcmFailure := 0, 0, 0, 0
	var stale []string
	if os.Getenv("NOTIFICATIONS_DELIVERY_ENABLED") != "false" {
		success, failure = h.sendExpoPush(tokens, req)
		sender := h.currentSender(ctx)
		if sender != nil {
			fcmSuccess, fcmFailure, stale = sender.send(ctx, fcmTokens, req)
		} else {
			fcmFailure = len(fcmTokens)
		}
	}
	success += fcmSuccess
	failure += fcmFailure
	if len(stale) > 0 {
		_, _ = h.db.Exec(ctx, `UPDATE notification_devices SET enabled = FALSE, updated_at = NOW() WHERE expo_push_token = ANY($1)`, stale)
	}
	target := len(tokens) + len(fcmTokens)

	messageID := newID("nm")
	dataBytes, _ := json.Marshal(req.Data)
	if len(dataBytes) == 0 || string(dataBytes) == "null" {
		dataBytes = []byte(`{}`)
	}

	_, saveErr := h.db.Exec(
		ctx,
		`
			INSERT INTO notification_messages (id, title, body, category, data, target_count, success_count, failure_count, audience, audience_label, sent_by, channels)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::uuid[], COALESCE(NULLIF($10, ''), 'Everyone'), NULLIF($11, '')::uuid, COALESCE($12::text[], '{push}'))
		`,
		messageID, req.Title, req.Body, req.Category, string(dataBytes), target, success, failure, audience(req.UserIDs), req.AudienceLabel, req.SentBy, nilIfEmpty(req.Channels),
	)

	if saveErr != nil {
		return nil, saveErr
	}
	return gin.H{"id": messageID, "targetCount": target, "successCount": success, "failureCount": failure}, nil
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

// Returns Expo tokens and FCM tokens of devices that want this category.
func (h Handler) tokensForCategory(ctx context.Context, category string, userIDs []string) ([]string, []string, error) {
	rows, err := h.db.Query(
		ctx,
		`
			SELECT expo_push_token, provider
			FROM notification_devices
			WHERE enabled = TRUE
			  AND (
			    preferences = '{}'::jsonb
			    OR COALESCE((preferences ->> $1)::boolean, TRUE) = TRUE
			  )
			  AND ($2::text[] IS NULL OR user_id::text = ANY($2))
		`,
		category, audience(userIDs),
	)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	tokens := make([]string, 0)
	fcmTokens := make([]string, 0)

	for rows.Next() {
		var token, provider string
		if err := rows.Scan(&token, &provider); err != nil {
			return nil, nil, err
		}

		if provider == "fcm" {
			fcmTokens = append(fcmTokens, token)
		} else if validExpoToken(token) {
			tokens = append(tokens, token)
		}
	}

	return tokens, fcmTokens, rows.Err()
}

// GET /notifications/feed?since=RFC3339: recent announcements, for phones
// that check in themselves (no push service set up yet, or missed pushes).
func (h Handler) Feed(c *gin.Context) {
	since := time.Now().Add(-7 * 24 * time.Hour)
	if raw := strings.TrimSpace(c.Query("since")); raw != "" {
		if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
			since = parsed
		}
	}
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, title, body, category, data, created_at FROM notification_messages
		WHERE created_at > $1 AND (audience IS NULL OR NULLIF($2, '')::uuid = ANY(audience))
		ORDER BY created_at DESC LIMIT 20
	`, since, signedIn(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load notifications"})
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, title, body, category string
		var data json.RawMessage
		var created time.Time
		if err := rows.Scan(&id, &title, &body, &category, &data, &created); err != nil {
			continue
		}
		items = append(items, gin.H{"id": id, "title": title, "body": body, "category": category, "data": data, "createdAt": created.UTC().Format(time.RFC3339)})
	}
	c.JSON(http.StatusOK, gin.H{"messages": items})
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

// audience is nil for everyone, or the chosen members (an empty group reaches nobody).
func audience(ids []string) []string {
	if ids == nil {
		return nil
	}
	return append([]string{}, ids...)
}

func nilIfEmpty(v []string) []string {
	if len(v) == 0 {
		return nil
	}
	return v
}

func signedIn(c *gin.Context) string {
	id, _ := auth.UserIDFromContext(c)
	return id
}
