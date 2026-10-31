package superadmin

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	mailer "github.com/ariga/shekinah-backend/internal/mail"
	"github.com/ariga/shekinah-backend/internal/notifications"
	"github.com/gin-gonic/gin"
)

// Notifier sends a push and records it in the notification feed.
type Notifier func(context.Context, notifications.BroadcastRequest) (gin.H, error)

// WithMessaging lets staff message the church or part of it.
func (h *Handler) WithMessaging(notify Notifier, mailSecret string) *Handler {
	h.notify, h.mail = notify, mailer.Store{DB: h.db, Secret: mailSecret}
	return h
}

// resolveAudience returns the members a message is for (nil = everyone) and a label.
func (h *Handler) resolveAudience(ctx context.Context, kind, id string) ([]string, string, error) {
	var sql, label string
	switch kind {
	case "", "all":
		return nil, "Everyone", nil
	case "group":
		sql = `SELECT m.user_id::text FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND u.is_active AND u.deleted_at IS NULL`
		if h.db.QueryRow(ctx, `SELECT name FROM ministry_groups WHERE id=$1`, id).Scan(&label) != nil {
			return nil, "", fmt.Errorf("group not found")
		}
	case "role":
		sql = `SELECT id::text FROM users WHERE staff_role_id=$1 AND is_active AND deleted_at IS NULL`
		if h.db.QueryRow(ctx, `SELECT name FROM staff_roles WHERE id=$1`, id).Scan(&label) != nil {
			return nil, "", fmt.Errorf("role not found")
		}
	case "status":
		if !slices.Contains(statuses, id) {
			return nil, "", fmt.Errorf("unknown membership status")
		}
		sql, label = `SELECT id::text FROM users WHERE membership_status=$1 AND is_active AND deleted_at IS NULL`, "All "+id+"s"
	case "staff":
		sql, label = `SELECT u.id::text FROM users u WHERE u.is_active AND u.deleted_at IS NULL AND (u.role<>'member' OR cardinality(u.permissions)>0 OR u.staff_role_id IS NOT NULL)`, "All staff"
	default:
		return nil, "", fmt.Errorf("unknown audience")
	}
	args := []any{id}
	if kind == "staff" {
		args = nil
	}
	rows, err := h.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) == nil {
			ids = append(ids, uid)
		}
	}
	return ids, label, rows.Err()
}

// SendMessage: push (and the in-app feed) and/or email to everyone or a part
// of the church. Recorded in the sent log.
func (h *Handler) SendMessage(c *gin.Context) {
	var req struct {
		Title    string   `json:"title"`
		Body     string   `json:"body"`
		Audience string   `json:"audience"`
		TargetID string   `json:"targetId"`
		Channels []string `json:"channels"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Body) == "" {
		fail(c, http.StatusBadRequest, "Write a title and a message")
		return
	}
	if len(req.Title) > 120 || len(req.Body) > 2000 {
		fail(c, http.StatusBadRequest, "Keep the title under 120 characters and the message under 2,000")
		return
	}
	push, email := slices.Contains(req.Channels, "push"), slices.Contains(req.Channels, "email")
	if !push && !email {
		fail(c, http.StatusBadRequest, "Choose push, email or both")
		return
	}
	ctx := c.Request.Context()
	ids, label, err := h.resolveAudience(ctx, req.Audience, req.TargetID)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	config, _, cfgErr := h.mail.Load(ctx)
	if email && (cfgErr != nil || !config.Configured()) {
		fail(c, http.StatusServiceUnavailable, "Email isn't set up yet. Send as push only, or add email in Settings → Email.")
		return
	}
	if h.notify == nil {
		fail(c, http.StatusServiceUnavailable, "Messaging is unavailable")
		return
	}
	sender, _ := auth.UserIDFromContext(c)
	channels := []string{}
	if push {
		channels = append(channels, "push")
	}
	if email {
		channels = append(channels, "email")
	}
	result, err := h.notify(ctx, notifications.BroadcastRequest{
		Title: strings.TrimSpace(req.Title), Body: strings.TrimSpace(req.Body), Category: "general",
		UserIDs: ids, AudienceLabel: label, SentBy: sender, Channels: channels,
		Data: map[string]interface{}{"open": "notifications"},
	})
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not send the message")
		return
	}
	if !push {
		// Email only: the log entry exists, but nobody gets a push.
		_, _ = h.db.Exec(ctx, `UPDATE notification_messages SET target_count=0,success_count=0,failure_count=0 WHERE id=$1`, result["id"])
	}
	messageID := fmt.Sprint(result["id"])
	if email {
		go h.emailAudience(messageID, ids, strings.TrimSpace(req.Title), strings.TrimSpace(req.Body))
	}
	h.audit(c, "MESSAGE_SENT", fmt.Sprintf("Message to %s via %s: %s", label, strings.Join(channels, "+"), strings.TrimSpace(req.Title)), messageID)
	c.JSON(http.StatusOK, gin.H{"id": messageID, "audience": label, "recipients": len(ids), "push": result, "message": "Message sent to " + label})
}

func (h *Handler) emailAudience(id string, ids []string, title, body string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	config, _, err := h.mail.Load(ctx)
	if err != nil {
		return
	}
	query, args := `SELECT email FROM users WHERE is_active AND deleted_at IS NULL AND email<>''`, []any{}
	if ids != nil {
		query, args = query+` AND id::text = ANY($1)`, []any{ids}
	}
	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		return
	}
	var emails []string
	for rows.Next() {
		var e string
		if rows.Scan(&e) == nil {
			emails = append(emails, e)
		}
	}
	rows.Close()
	sent := 0
	for _, e := range emails {
		// One message per person, so addresses are never shared.
		if err := mailer.SendWithConfig(config, mailer.Message{To: []string{e}, Subject: title, Heading: title, Intro: body, Footer: "Sent by Shekinah Sons Global."}); err != nil {
			log.Printf("message %s: email failed: %v", id, err)
			continue
		}
		sent++
		if sent%20 == 0 {
			_, _ = h.db.Exec(ctx, `UPDATE notification_messages SET email_count=$2 WHERE id=$1`, id, sent)
		}
	}
	_, _ = h.db.Exec(ctx, `UPDATE notification_messages SET email_count=$2 WHERE id=$1`, id, sent)
}

// ListMessages is the sent log.
func (h *Handler) ListMessages(c *gin.Context) {
	items, err := h.rows(c.Request.Context(), `SELECT m.id,m.title,m.body,m.audience_label AS audience,m.channels,m.target_count AS "pushDevices",m.success_count AS "pushDelivered",
		m.failure_count AS "pushFailed",m.email_count AS "emailsSent",COALESCE(u.email,'') AS "sentBy",m.created_at AS "createdAt"
		FROM notification_messages m LEFT JOIN users u ON u.id=m.sent_by ORDER BY m.created_at DESC LIMIT 200`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load the sent log")
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": items})
}

// RotateApiKey replaces a key's secret: same name and permissions, the old
// secret stops working at once.
func (h *Handler) RotateApiKey(c *gin.Context) {
	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		fail(c, http.StatusServiceUnavailable, "Database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	var name string
	var perms []string
	if tx.QueryRow(ctx, `UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL RETURNING name,permissions`, c.Param("id")).Scan(&name, &perms) != nil {
		fail(c, http.StatusNotFound, "Key not found or already revoked")
		return
	}
	key := newAPIKey()
	creator, _ := auth.UserIDFromContext(c)
	id := randomID("key")
	if _, err := tx.Exec(ctx, `INSERT INTO api_keys(id,name,key_prefix,key_hash,permissions,created_by) VALUES($1,$2,$3,$4,$5,$6::uuid)`,
		id, name, key[:12]+"…", auth.HashAPIKey(key), perms, creator); err != nil || tx.Commit(ctx) != nil {
		fail(c, http.StatusInternalServerError, "Could not rotate the key")
		return
	}
	h.audit(c, "API_KEY_ROTATED", "Rotated API key "+name, id)
	c.JSON(http.StatusCreated, gin.H{"id": id, "key": key, "message": "New key created and the old one revoked. Copy it now; it will not be shown again."})
}
