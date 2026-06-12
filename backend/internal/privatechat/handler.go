package privatechat

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"sort"
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

type DeviceRequest struct {
	DeviceID          string `json:"deviceId"`
	Label             string `json:"label"`
	IdentityPublicKey string `json:"identityPublicKey"`
	SigningPublicKey  string `json:"signingPublicKey"`
}

type ThreadRequest struct {
	RecipientUserID string `json:"recipientUserId"`
}

type RequestActionRequest struct {
	Action string `json:"action"`
}

type MessageRequest struct {
	Ciphertext               string `json:"ciphertext"`
	Nonce                    string `json:"nonce"`
	SenderEphemeralPublicKey string `json:"senderEphemeralPublicKey"`
	SenderCopyCiphertext     string `json:"senderCopyCiphertext"`
	SenderCopyNonce          string `json:"senderCopyNonce"`
	Signature                string `json:"signature"`
	RecipientDeviceID        string `json:"recipientDeviceId"`
	ProtocolVersion          string `json:"protocolVersion"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func newID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

func fingerprintForKey(value string) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return strings.ToUpper(hex.EncodeToString(hash[:8]))
}

func cleanProtocolVersion(value string) string {
	if strings.TrimSpace(value) == "" {
		return "e2ee-v1"
	}
	return strings.TrimSpace(value)
}

func sortedPairKey(a string, b string) string {
	items := []string{strings.TrimSpace(a), strings.TrimSpace(b)}
	sort.Strings(items)
	return items[0] + ":" + items[1]
}

func cleanRequestAction(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "accept", "reject":
		return strings.TrimSpace(strings.ToLower(value))
	default:
		return ""
	}
}

func userIDRequired(c *gin.Context) (string, bool) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok || strings.TrimSpace(userID) == "" {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return "", false
	}
	return strings.TrimSpace(userID), true
}

func (h Handler) RegisterDevice(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	var req DeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid device registration payload")
		return
	}

	deviceID := strings.TrimSpace(req.DeviceID)
	publicKey := strings.TrimSpace(req.IdentityPublicKey)
	signingPublicKey := strings.TrimSpace(req.SigningPublicKey)
	if deviceID == "" || publicKey == "" || signingPublicKey == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "device id, identity public key, and signing public key are required")
		return
	}

	_, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO private_chat_devices (
				user_id,
				device_id,
				label,
				identity_public_key,
				signing_public_key,
				active
			)
			VALUES ($1, $2, $3, $4, $5, TRUE)
			ON CONFLICT (user_id, device_id)
			DO UPDATE SET
				label = EXCLUDED.label,
				identity_public_key = EXCLUDED.identity_public_key,
				signing_public_key = EXCLUDED.signing_public_key,
				active = TRUE,
				updated_at = NOW(),
				last_seen_at = NOW()
		`,
		userID,
		deviceID,
		strings.TrimSpace(req.Label),
		publicKey,
		signingPublicKey,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_device_failed", "failed to register device")
		return
	}

	httpx.OK(c, gin.H{
		"device": gin.H{
			"deviceId":          deviceID,
			"label":             strings.TrimSpace(req.Label),
			"identityPublicKey": publicKey,
			"signingPublicKey":  signingPublicKey,
			"fingerprint":       fingerprintForKey(publicKey),
		},
	})
}

func (h Handler) Contacts(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				u.id::text,
				COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS display_name,
				u.email,
				COALESCE(d.device_id, '') AS device_id,
				COALESCE(d.label, '') AS device_label,
				COALESCE(d.identity_public_key, '') AS identity_public_key,
				COALESCE(d.signing_public_key, '') AS signing_public_key
			FROM users u
			LEFT JOIN LATERAL (
				SELECT device_id, label, identity_public_key, signing_public_key
				FROM private_chat_devices
				WHERE user_id = u.id
				  AND active = TRUE
				ORDER BY updated_at DESC
				LIMIT 1
			) d ON TRUE
			WHERE u.is_active = TRUE
			  AND u.id <> $1
			ORDER BY display_name ASC
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_contacts_failed", "failed to load private chat contacts")
		return
	}
	defer rows.Close()

	contacts := make([]gin.H, 0)
	for rows.Next() {
		var contactID string
		var displayName string
		var email string
		var deviceID string
		var deviceLabel string
		var identityPublicKey string
		var signingPublicKey string

		if err := rows.Scan(&contactID, &displayName, &email, &deviceID, &deviceLabel, &identityPublicKey, &signingPublicKey); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_contacts_failed", "failed to load private chat contacts")
			return
		}

		contacts = append(contacts, gin.H{
			"id":          contactID,
			"displayName": displayName,
			"email":       email,
			"hasDevice":   deviceID != "",
			"device": gin.H{
				"deviceId":          deviceID,
				"label":             deviceLabel,
				"identityPublicKey": identityPublicKey,
				"signingPublicKey":  signingPublicKey,
				"fingerprint":       fingerprintForKey(identityPublicKey),
			},
		})
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_contacts_failed", "failed to load private chat contacts")
		return
	}

	httpx.OK(c, gin.H{"contacts": contacts})
}

func (h Handler) activeDeviceExists(ctx context.Context, userID string) (bool, error) {
	var hasDevice bool
	err := h.db.QueryRow(
		ctx,
		`
			SELECT EXISTS (
				SELECT 1
				FROM private_chat_devices
				WHERE user_id = $1
				  AND active = TRUE
			)
		`,
		userID,
	).Scan(&hasDevice)
	return hasDevice, err
}

func (h Handler) ensureThread(ctx context.Context, userID string, recipientID string) (string, error) {
	pairKey := sortedPairKey(userID, recipientID)

	tx, err := h.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	threadID := ""
	err = tx.QueryRow(
		ctx,
		`
			SELECT id
			FROM private_chat_threads
			WHERE pair_key = $1
			LIMIT 1
		`,
		pairKey,
	).Scan(&threadID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	if errors.Is(err, pgx.ErrNoRows) {
		threadID = newID("pth")
		if _, err := tx.Exec(
			ctx,
			`
				INSERT INTO private_chat_threads (id, kind, pair_key)
				VALUES ($1, 'direct', $2)
			`,
			threadID,
			pairKey,
		); err != nil {
			return "", err
		}

		for _, member := range []string{userID, recipientID} {
			if _, err := tx.Exec(
				ctx,
				`
					INSERT INTO private_chat_thread_members (thread_id, user_id)
					VALUES ($1, $2)
					ON CONFLICT (thread_id, user_id) DO NOTHING
				`,
				threadID,
				member,
			); err != nil {
				return "", err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}

	return threadID, nil
}

func (h Handler) MemberProfile(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	targetUserID := strings.TrimSpace(c.Param("id"))
	if targetUserID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid member id is required")
		return
	}

	var displayName string
	var joinedAt time.Time
	var communityCount int
	var testimonyCount int
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT
				COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS display_name,
				u.created_at,
				COALESCE((
					SELECT COUNT(*)
					FROM community_messages cm
					WHERE cm.user_id = u.id
					  AND cm.status = 'approved'
				), 0) AS community_count,
				COALESCE((
					SELECT COUNT(*)
					FROM testimonies t
					WHERE t.user_id = u.id
					  AND t.status = 'approved'
				), 0) AS testimony_count
			FROM users u
			WHERE u.id = $1
			  AND u.is_active = TRUE
			LIMIT 1
		`,
		targetUserID,
	).Scan(&displayName, &joinedAt, &communityCount, &testimonyCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "not_found", "member not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, "member_profile_failed", "failed to load member profile")
		return
	}

	hasDevice, err := h.activeDeviceExists(c.Request.Context(), targetUserID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "member_profile_failed", "failed to load member profile")
		return
	}

	pairKey := sortedPairKey(userID, targetUserID)
	var requestID string
	var requestStatus string
	var requesterUserID string
	var recipientUserID string
	err = h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT id, status, requester_user_id::text, recipient_user_id::text
			FROM private_chat_requests
			WHERE pair_key = $1
			LIMIT 1
		`,
		pairKey,
	).Scan(&requestID, &requestStatus, &requesterUserID, &recipientUserID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(c, http.StatusInternalServerError, "member_profile_failed", "failed to load member profile")
		return
	}
	if errors.Is(err, pgx.ErrNoRows) {
		requestID = ""
		requestStatus = ""
		requesterUserID = ""
		recipientUserID = ""
	}

	threadID := ""
	err = h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT id
			FROM private_chat_threads
			WHERE pair_key = $1
			LIMIT 1
		`,
		pairKey,
	).Scan(&threadID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(c, http.StatusInternalServerError, "member_profile_failed", "failed to load member profile")
		return
	}
	if errors.Is(err, pgx.ErrNoRows) {
		threadID = ""
	}

	direction := ""
	if requestStatus == "pending" {
		if requesterUserID == userID {
			direction = "outgoing"
		} else if recipientUserID == userID {
			direction = "incoming"
		}
	}

	httpx.OK(c, gin.H{
		"member": gin.H{
			"id":               targetUserID,
			"displayName":      displayName,
			"joinedAt":         formatTime(joinedAt),
			"isSelf":           targetUserID == userID,
			"hasDevice":        hasDevice,
			"communityCount":   communityCount,
			"testimonyCount":   testimonyCount,
			"requestId":        requestID,
			"requestStatus":    requestStatus,
			"requestDirection": direction,
			"threadId":         threadID,
		},
	})
}

func (h Handler) CreateRequest(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	var req ThreadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid private chat request payload")
		return
	}

	recipientID := strings.TrimSpace(req.RecipientUserID)
	if recipientID == "" || recipientID == userID {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid recipient is required")
		return
	}

	var recipientName string
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT COALESCE(NULLIF(TRIM(name), ''), email)
			FROM users
			WHERE id = $1
			  AND is_active = TRUE
			LIMIT 1
		`,
		recipientID,
	).Scan(&recipientName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "not_found", "recipient not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to create chat request")
		return
	}

	hasDevice, err := h.activeDeviceExists(c.Request.Context(), userID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to create chat request")
		return
	}
	if !hasDevice {
		httpx.Error(c, http.StatusConflict, "private_chat_device_missing", "open Private once to enable encrypted chat on this device")
		return
	}

	pairKey := sortedPairKey(userID, recipientID)
	var existingThreadID string
	err = h.db.QueryRow(
		c.Request.Context(),
		`SELECT id FROM private_chat_threads WHERE pair_key = $1 LIMIT 1`,
		pairKey,
	).Scan(&existingThreadID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to create chat request")
		return
	}
	if existingThreadID != "" {
		httpx.Error(c, http.StatusConflict, "private_chat_exists", "private chat is already available with this member")
		return
	}

	requestID := newID("preq")
	err = h.db.QueryRow(
		c.Request.Context(),
		`
			INSERT INTO private_chat_requests (
				id,
				pair_key,
				requester_user_id,
				recipient_user_id,
				status,
				updated_at,
				responded_at
			)
			VALUES ($1, $2, $3, $4, 'pending', NOW(), NULL)
			ON CONFLICT (pair_key)
			DO UPDATE SET
				requester_user_id = EXCLUDED.requester_user_id,
				recipient_user_id = EXCLUDED.recipient_user_id,
				status = 'pending',
				updated_at = NOW(),
				responded_at = NULL
			RETURNING id
		`,
		requestID,
		pairKey,
		userID,
		recipientID,
	).Scan(&requestID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to create chat request")
		return
	}

	httpx.Created(c, gin.H{
		"request": gin.H{
			"id":          requestID,
			"status":      "pending",
			"direction":   "outgoing",
			"recipientId": recipientID,
			"displayName": recipientName,
			"createdAt":   formatTime(time.Now().UTC()),
		},
	})
}

func (h Handler) ListRequests(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				r.id,
				r.status,
				r.requester_user_id::text,
				r.recipient_user_id::text,
				r.created_at,
				r.updated_at,
				u.id::text,
				COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS display_name,
				COALESCE(d.device_id, '') AS device_id,
				COALESCE(d.identity_public_key, '') AS identity_public_key,
				COALESCE(d.signing_public_key, '') AS signing_public_key
			FROM private_chat_requests r
			JOIN users u
			  ON u.id = CASE
					WHEN r.requester_user_id = $1 THEN r.recipient_user_id
					ELSE r.requester_user_id
				END
			LEFT JOIN LATERAL (
				SELECT device_id, identity_public_key, signing_public_key
				FROM private_chat_devices
				WHERE user_id = u.id
				  AND active = TRUE
				ORDER BY updated_at DESC
				LIMIT 1
			) d ON TRUE
			WHERE (r.requester_user_id = $1 OR r.recipient_user_id = $1)
			  AND r.status = 'pending'
			ORDER BY r.updated_at DESC
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_requests_failed", "failed to load private chat requests")
		return
	}
	defer rows.Close()

	incoming := make([]gin.H, 0)
	outgoing := make([]gin.H, 0)
	for rows.Next() {
		var id string
		var status string
		var requesterID string
		var recipientID string
		var createdAt time.Time
		var updatedAt time.Time
		var peerID string
		var displayName string
		var deviceID string
		var identityPublicKey string
		var signingPublicKey string
		if err := rows.Scan(&id, &status, &requesterID, &recipientID, &createdAt, &updatedAt, &peerID, &displayName, &deviceID, &identityPublicKey, &signingPublicKey); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_requests_failed", "failed to load private chat requests")
			return
		}

		item := gin.H{
			"id":        id,
			"status":    status,
			"createdAt": formatTime(createdAt),
			"updatedAt": formatTime(updatedAt),
			"direction": "incoming",
			"peer": gin.H{
				"id":          peerID,
				"displayName": displayName,
				"deviceId":    deviceID,
				"publicKey":   identityPublicKey,
				"signingKey":  signingPublicKey,
				"fingerprint": fingerprintForKey(identityPublicKey),
				"hasDevice":   deviceID != "",
			},
		}

		if requesterID == userID {
			item["direction"] = "outgoing"
			outgoing = append(outgoing, item)
		} else {
			incoming = append(incoming, item)
		}
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_requests_failed", "failed to load private chat requests")
		return
	}

	httpx.OK(c, gin.H{
		"incoming": incoming,
		"outgoing": outgoing,
	})
}

func (h Handler) RespondRequest(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	requestID := strings.TrimSpace(c.Param("id"))
	if requestID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid request id is required")
		return
	}

	var req RequestActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid private chat request action")
		return
	}
	action := cleanRequestAction(req.Action)
	if action == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "action must be accept or reject")
		return
	}

	var requesterID string
	var recipientID string
	var status string
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT requester_user_id::text, recipient_user_id::text, status
			FROM private_chat_requests
			WHERE id = $1
			LIMIT 1
		`,
		requestID,
	).Scan(&requesterID, &recipientID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "not_found", "chat request not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to update chat request")
		return
	}

	if recipientID != userID {
		httpx.Error(c, http.StatusForbidden, "private_chat_forbidden", "request access denied")
		return
	}
	if status != "pending" {
		httpx.Error(c, http.StatusConflict, "private_chat_request_closed", "chat request is no longer pending")
		return
	}

	nextStatus := "rejected"
	if action == "accept" {
		requesterHasDevice, err := h.activeDeviceExists(c.Request.Context(), requesterID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to update chat request")
			return
		}
		recipientHasDevice, err := h.activeDeviceExists(c.Request.Context(), recipientID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to update chat request")
			return
		}
		if !requesterHasDevice || !recipientHasDevice {
			httpx.Error(c, http.StatusConflict, "private_chat_device_missing", "both members must enable encrypted chat before acceptance")
			return
		}
		nextStatus = "accepted"
	}

	_, err = h.db.Exec(
		c.Request.Context(),
		`
			UPDATE private_chat_requests
			SET status = $2,
			    updated_at = NOW(),
			    responded_at = NOW()
			WHERE id = $1
		`,
		requestID,
		nextStatus,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_request_failed", "failed to update chat request")
		return
	}

	response := gin.H{
		"request": gin.H{
			"id":     requestID,
			"status": nextStatus,
		},
	}

	if nextStatus == "accepted" {
		threadID, err := h.ensureThread(c.Request.Context(), requesterID, recipientID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_thread_failed", "failed to create private thread")
			return
		}
		thread, err := h.threadSummary(c.Request.Context(), threadID, userID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_thread_failed", "failed to load private thread")
			return
		}
		response["thread"] = thread
	}

	httpx.OK(c, response)
}

func (h Handler) CreateThread(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	var req ThreadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid private chat thread payload")
		return
	}

	recipientID := strings.TrimSpace(req.RecipientUserID)
	if recipientID == "" || recipientID == userID {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid recipient is required")
		return
	}

	hasDevice, err := h.activeDeviceExists(c.Request.Context(), recipientID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_thread_failed", "failed to prepare private thread")
		return
	}
	if !hasDevice {
		httpx.Error(c, http.StatusConflict, "private_chat_device_missing", "recipient has not enabled encrypted chat yet")
		return
	}

	pairKey := sortedPairKey(userID, recipientID)
	var accepted bool
	err = h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT EXISTS (
				SELECT 1
				FROM private_chat_requests
				WHERE pair_key = $1
				  AND status = 'accepted'
			)
		`,
		pairKey,
	).Scan(&accepted)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_thread_failed", "failed to prepare private thread")
		return
	}
	if !accepted {
		httpx.Error(c, http.StatusForbidden, "private_chat_request_required", "private chat request must be accepted first")
		return
	}

	threadID, err := h.ensureThread(c.Request.Context(), userID, recipientID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_thread_failed", "failed to create private thread")
		return
	}

	thread, err := h.threadSummary(c.Request.Context(), threadID, userID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_thread_failed", "failed to load private thread")
		return
	}

	httpx.Created(c, gin.H{"thread": thread})
}

func (h Handler) ListThreads(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				t.id,
				t.kind,
				COALESCE(t.last_message_at, t.updated_at) AS last_message_at,
				u.id::text AS peer_id,
				COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS peer_name,
				u.email AS peer_email,
				COALESCE(d.device_id, '') AS device_id,
				COALESCE(d.identity_public_key, '') AS identity_public_key,
				COALESCE(d.signing_public_key, '') AS signing_public_key
			FROM private_chat_threads t
			JOIN private_chat_thread_members self
			  ON self.thread_id = t.id
			 AND self.user_id = $1
			JOIN private_chat_thread_members peer
			  ON peer.thread_id = t.id
			 AND peer.user_id <> $1
			JOIN users u ON u.id = peer.user_id
			LEFT JOIN LATERAL (
				SELECT device_id, identity_public_key, signing_public_key
				FROM private_chat_devices
				WHERE user_id = u.id
				  AND active = TRUE
				ORDER BY updated_at DESC
				LIMIT 1
			) d ON TRUE
			ORDER BY COALESCE(t.last_message_at, t.updated_at) DESC
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_threads_failed", "failed to load private threads")
		return
	}
	defer rows.Close()

	threads := make([]gin.H, 0)
	for rows.Next() {
		var id string
		var kind string
		var lastMessageAt time.Time
		var peerID string
		var peerName string
		var peerEmail string
		var deviceID string
		var identityPublicKey string
		var signingPublicKey string

		if err := rows.Scan(&id, &kind, &lastMessageAt, &peerID, &peerName, &peerEmail, &deviceID, &identityPublicKey, &signingPublicKey); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_threads_failed", "failed to load private threads")
			return
		}

		threads = append(threads, gin.H{
			"id":            id,
			"kind":          kind,
			"lastMessageAt": formatTime(lastMessageAt),
			"peer": gin.H{
				"id":          peerID,
				"displayName": peerName,
				"email":       peerEmail,
				"deviceId":    deviceID,
				"publicKey":   identityPublicKey,
				"signingKey":  signingPublicKey,
				"fingerprint": fingerprintForKey(identityPublicKey),
			},
		})
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_threads_failed", "failed to load private threads")
		return
	}

	httpx.OK(c, gin.H{"threads": threads})
}

func (h Handler) threadSummary(ctx context.Context, threadID string, userID string) (gin.H, error) {
	var kind string
	var lastMessageAt time.Time
	var peerID string
	var peerName string
	var peerEmail string
	var deviceID string
	var identityPublicKey string
	var signingPublicKey string

	err := h.db.QueryRow(
		ctx,
		`
			SELECT
				t.id,
				t.kind,
				COALESCE(t.last_message_at, t.updated_at) AS last_message_at,
				u.id::text AS peer_id,
				COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS peer_name,
				u.email AS peer_email,
				COALESCE(d.device_id, '') AS device_id,
				COALESCE(d.identity_public_key, '') AS identity_public_key,
				COALESCE(d.signing_public_key, '') AS signing_public_key
			FROM private_chat_threads t
			JOIN private_chat_thread_members self
			  ON self.thread_id = t.id
			 AND self.user_id = $2
			JOIN private_chat_thread_members peer
			  ON peer.thread_id = t.id
			 AND peer.user_id <> $2
			JOIN users u ON u.id = peer.user_id
			LEFT JOIN LATERAL (
				SELECT device_id, identity_public_key, signing_public_key
				FROM private_chat_devices
				WHERE user_id = u.id
				  AND active = TRUE
				ORDER BY updated_at DESC
				LIMIT 1
			) d ON TRUE
			WHERE t.id = $1
			LIMIT 1
		`,
		threadID,
		userID,
	).Scan(&threadID, &kind, &lastMessageAt, &peerID, &peerName, &peerEmail, &deviceID, &identityPublicKey, &signingPublicKey)
	if err != nil {
		return nil, err
	}

	return gin.H{
		"id":            threadID,
		"kind":          kind,
		"lastMessageAt": formatTime(lastMessageAt),
		"peer": gin.H{
			"id":          peerID,
			"displayName": peerName,
			"email":       peerEmail,
			"deviceId":    deviceID,
			"publicKey":   identityPublicKey,
			"signingKey":  signingPublicKey,
			"fingerprint": fingerprintForKey(identityPublicKey),
		},
	}, nil
}

func (h Handler) ListMessages(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	threadID := strings.TrimSpace(c.Param("id"))
	if threadID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid thread id is required")
		return
	}

	var allowed bool
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT EXISTS (
				SELECT 1
				FROM private_chat_thread_members
				WHERE thread_id = $1
				  AND user_id = $2
			)
		`,
		threadID,
		userID,
	).Scan(&allowed)
	if err != nil || !allowed {
		httpx.Error(c, http.StatusForbidden, "private_chat_forbidden", "thread access denied")
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				m.id,
				m.sender_user_id::text,
				COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS sender_name,
				m.ciphertext,
				m.nonce,
				m.sender_ephemeral_public_key,
				m.sender_copy_ciphertext,
				m.sender_copy_nonce,
				m.signature,
				m.recipient_device_id,
				m.protocol_version,
				m.created_at
			FROM private_chat_messages m
			JOIN users u ON u.id = m.sender_user_id
			WHERE m.thread_id = $1
			ORDER BY m.created_at ASC
			LIMIT 500
		`,
		threadID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_messages_failed", "failed to load private chat messages")
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var id string
		var senderUserID string
		var senderName string
		var ciphertext string
		var nonce string
		var senderEphemeralPublicKey string
		var senderCopyCiphertext string
		var senderCopyNonce string
		var signature string
		var recipientDeviceID string
		var protocolVersion string
		var createdAt time.Time

		if err := rows.Scan(
			&id,
			&senderUserID,
			&senderName,
			&ciphertext,
			&nonce,
			&senderEphemeralPublicKey,
			&senderCopyCiphertext,
			&senderCopyNonce,
			&signature,
			&recipientDeviceID,
			&protocolVersion,
			&createdAt,
		); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_messages_failed", "failed to load private chat messages")
			return
		}

		items = append(items, gin.H{
			"id":                       id,
			"senderUserId":             senderUserID,
			"senderDisplayName":        senderName,
			"ciphertext":               ciphertext,
			"nonce":                    nonce,
			"senderEphemeralPublicKey": senderEphemeralPublicKey,
			"senderCopyCiphertext":     senderCopyCiphertext,
			"senderCopyNonce":          senderCopyNonce,
			"signature":                signature,
			"recipientDeviceId":        recipientDeviceID,
			"protocolVersion":          protocolVersion,
			"createdAt":                formatTime(createdAt),
		})
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_messages_failed", "failed to load private chat messages")
		return
	}

	httpx.OK(c, gin.H{"messages": items})
}

func (h Handler) SendMessage(c *gin.Context) {
	userID, ok := userIDRequired(c)
	if !ok {
		return
	}

	threadID := strings.TrimSpace(c.Param("id"))
	if threadID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid thread id is required")
		return
	}

	var req MessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid encrypted message payload")
		return
	}

	if strings.TrimSpace(req.Ciphertext) == "" || strings.TrimSpace(req.Nonce) == "" || strings.TrimSpace(req.SenderEphemeralPublicKey) == "" || strings.TrimSpace(req.SenderCopyCiphertext) == "" || strings.TrimSpace(req.SenderCopyNonce) == "" || strings.TrimSpace(req.Signature) == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "ciphertext, nonces, sender copy, ephemeral public key, and signature are required")
		return
	}

	var allowed bool
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT EXISTS (
				SELECT 1
				FROM private_chat_thread_members
				WHERE thread_id = $1
				  AND user_id = $2
			)
		`,
		threadID,
		userID,
	).Scan(&allowed)
	if err != nil || !allowed {
		httpx.Error(c, http.StatusForbidden, "private_chat_forbidden", "thread access denied")
		return
	}

	recipientDeviceID := strings.TrimSpace(req.RecipientDeviceID)
	if recipientDeviceID != "" {
		var validRecipientDevice bool
		err = h.db.QueryRow(
			c.Request.Context(),
			`
				SELECT EXISTS (
					SELECT 1
					FROM private_chat_thread_members self
					JOIN private_chat_thread_members peer
					  ON peer.thread_id = self.thread_id
					 AND peer.user_id <> self.user_id
					JOIN private_chat_devices d
					  ON d.user_id = peer.user_id
					 AND d.device_id = $3
					 AND d.active = TRUE
					WHERE self.thread_id = $1
					  AND self.user_id = $2
				)
			`,
			threadID,
			userID,
			recipientDeviceID,
		).Scan(&validRecipientDevice)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "private_chat_send_failed", "failed to validate recipient device")
			return
		}
		if !validRecipientDevice {
			httpx.Error(c, http.StatusBadRequest, "invalid_input", "recipient device is not valid for this thread")
			return
		}
	}

	messageID := newID("pmsg")

	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_send_failed", "failed to store encrypted message")
		return
	}
	defer tx.Rollback(c.Request.Context())

	_, err = tx.Exec(
		c.Request.Context(),
		`
			INSERT INTO private_chat_messages (
				id,
				thread_id,
				sender_user_id,
				ciphertext,
				nonce,
				sender_ephemeral_public_key,
				sender_copy_ciphertext,
				sender_copy_nonce,
				signature,
				recipient_device_id,
				protocol_version
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`,
		messageID,
		threadID,
		userID,
		strings.TrimSpace(req.Ciphertext),
		strings.TrimSpace(req.Nonce),
		strings.TrimSpace(req.SenderEphemeralPublicKey),
		strings.TrimSpace(req.SenderCopyCiphertext),
		strings.TrimSpace(req.SenderCopyNonce),
		strings.TrimSpace(req.Signature),
		recipientDeviceID,
		cleanProtocolVersion(req.ProtocolVersion),
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_send_failed", "failed to store encrypted message")
		return
	}

	_, err = tx.Exec(
		c.Request.Context(),
		`
			UPDATE private_chat_threads
			SET updated_at = NOW(),
			    last_message_at = NOW()
			WHERE id = $1
		`,
		threadID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_send_failed", "failed to store encrypted message")
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "private_chat_send_failed", "failed to store encrypted message")
		return
	}

	httpx.Created(c, gin.H{
		"message": gin.H{
			"id":                       messageID,
			"threadId":                 threadID,
			"senderUserId":             userID,
			"ciphertext":               strings.TrimSpace(req.Ciphertext),
			"nonce":                    strings.TrimSpace(req.Nonce),
			"senderEphemeralPublicKey": strings.TrimSpace(req.SenderEphemeralPublicKey),
			"senderCopyCiphertext":     strings.TrimSpace(req.SenderCopyCiphertext),
			"senderCopyNonce":          strings.TrimSpace(req.SenderCopyNonce),
			"signature":                strings.TrimSpace(req.Signature),
			"recipientDeviceId":        recipientDeviceID,
			"protocolVersion":          cleanProtocolVersion(req.ProtocolVersion),
			"createdAt":                formatTime(time.Now().UTC()),
		},
	})
}
