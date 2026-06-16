package checkins

import (
	"crypto/rand"
	"errors"
	"math/big"
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

const checkinCodeTTL = 30 * time.Minute

type VerifyRequest struct {
	Code    string `json:"code"`
	EventID string `json:"eventId"`
	Notes   string `json:"notes"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func codeValue() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var builder strings.Builder

	for builder.Len() < 10 {
		index, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		builder.WriteByte(alphabet[index.Int64()])
	}

	return builder.String(), nil
}

func cleanCode(value string) string {
	code := strings.ToUpper(strings.TrimSpace(value))
	code = strings.ReplaceAll(code, " ", "")
	code = strings.ReplaceAll(code, "-", "")
	return code
}

func checkinID() string {
	return "checkin-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func (h Handler) MemberCode(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	code, err := codeValue()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkin_code_failed", "failed to prepare check-in code")
		return
	}

	now := time.Now().UTC()
	_, err = h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO member_checkin_codes (user_id, code)
			VALUES ($1, $2)
			ON CONFLICT (user_id)
			DO UPDATE SET code = EXCLUDED.code, updated_at = NOW()
		`,
		userID,
		code,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkin_code_failed", "failed to prepare check-in code")
		return
	}

	var displayName string
	err = h.db.QueryRow(
		c.Request.Context(),
		`SELECT COALESCE(NULLIF(TRIM(name), ''), email) FROM users WHERE id = $1`,
		userID,
	).Scan(&displayName)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkin_code_failed", "failed to prepare check-in code")
		return
	}

	httpx.OK(c, gin.H{
		"code":        code,
		"displayName": displayName,
		"generatedAt": now.Format(time.RFC3339),
		"expiresAt":   now.Add(checkinCodeTTL).Format(time.RFC3339),
	})
}

func (h Handler) Verify(c *gin.Context) {
	adminUserID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid check-in payload")
		return
	}

	code := cleanCode(req.Code)
	eventID := strings.TrimSpace(req.EventID)
	notes := strings.TrimSpace(req.Notes)

	if code == "" || eventID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "code and event are required")
		return
	}
	if len(code) != 10 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "enter a valid 10-character member code")
		return
	}
	if len(notes) > 500 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "attendance note must be 500 characters or fewer")
		return
	}

	var checkedInUserID string
	var memberName string
	var memberEmail string
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT u.id::text, COALESCE(NULLIF(TRIM(u.name), ''), 'Shekinah Member'), u.email
			FROM member_checkin_codes c
			JOIN users u ON u.id = c.user_id
			WHERE c.code = $1
			  AND c.updated_at >= NOW() - INTERVAL '30 minutes'
			  AND u.is_active = TRUE
			LIMIT 1
		`,
		code,
	).Scan(&checkedInUserID, &memberName, &memberEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "checkin_code_not_found", "check-in code not found or expired")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "checkin_verify_failed", "failed to verify check-in code")
		return
	}

	var eventTitle string
	err = h.db.QueryRow(
		c.Request.Context(),
		`SELECT title FROM events WHERE id = $1 LIMIT 1`,
		eventID,
	).Scan(&eventTitle)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "event_not_found", "event not found")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "checkin_verify_failed", "failed to verify check-in code")
		return
	}

	var alreadyCheckedIn bool
	if err := h.db.QueryRow(
		c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM event_checkins WHERE event_id = $1 AND user_id = $2)`,
		eventID,
		checkedInUserID,
	).Scan(&alreadyCheckedIn); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkin_verify_failed", "failed to verify check-in code")
		return
	}

	_, err = h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO event_checkins (
				id,
				event_id,
				user_id,
				checked_in_by,
				source,
				notes
			)
			VALUES ($1, $2, $3, $4, 'qr', $5)
			ON CONFLICT (event_id, user_id)
			DO UPDATE SET checked_in_by = EXCLUDED.checked_in_by,
			              notes = EXCLUDED.notes,
			              updated_at = NOW()
		`,
		checkinID(),
		eventID,
		checkedInUserID,
		adminUserID,
		notes,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkin_verify_failed", "failed to verify check-in code")
		return
	}

	httpx.OK(c, gin.H{
		"eventId":          eventID,
		"eventTitle":       eventTitle,
		"userId":           checkedInUserID,
		"name":             memberName,
		"email":            memberEmail,
		"checkedIn":        true,
		"alreadyCheckedIn": alreadyCheckedIn,
	})
}

func (h Handler) Recent(c *gin.Context) {
	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				ch.id,
				e.title,
				COALESCE(NULLIF(TRIM(u.name), ''), 'Shekinah Member'),
				u.email,
				ch.source,
				ch.notes,
				ch.created_at,
				ch.updated_at
			FROM event_checkins ch
			JOIN events e ON e.id = ch.event_id
			JOIN users u ON u.id = ch.user_id
			ORDER BY ch.created_at DESC
			LIMIT 200
		`,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkins_failed", "failed to load event check-ins")
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var id, eventTitle, name, email, source, notes string
		var createdAt time.Time
		var updatedAt time.Time
		if err := rows.Scan(&id, &eventTitle, &name, &email, &source, &notes, &createdAt, &updatedAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "checkins_failed", "failed to load event check-ins")
			return
		}

		items = append(items, gin.H{
			"id":         id,
			"eventTitle": eventTitle,
			"name":       name,
			"email":      email,
			"source":     source,
			"notes":      notes,
			"createdAt":  createdAt.UTC().Format(time.RFC3339),
			"updatedAt":  updatedAt.UTC().Format(time.RFC3339),
		})
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkins_failed", "failed to load event check-ins")
		return
	}

	httpx.OK(c, gin.H{"checkins": items})
}

func (h Handler) Mine(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				ch.id,
				e.title,
				to_char(e.event_date, 'FMMonth FMDD, YYYY') AS event_date,
				ch.source,
				ch.notes,
				ch.created_at
			FROM event_checkins ch
			JOIN events e ON e.id = ch.event_id
			WHERE ch.user_id = $1
			ORDER BY ch.created_at DESC
			LIMIT 50
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkins_failed", "failed to load your check-in history")
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var id, eventTitle, eventDate, source, notes string
		var createdAt time.Time
		if err := rows.Scan(&id, &eventTitle, &eventDate, &source, &notes, &createdAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "checkins_failed", "failed to load your check-in history")
			return
		}

		items = append(items, gin.H{
			"id":         id,
			"eventTitle": eventTitle,
			"eventDate":  eventDate,
			"source":     source,
			"notes":      notes,
			"createdAt":  createdAt.UTC().Format(time.RFC3339),
		})
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "checkins_failed", "failed to load your check-in history")
		return
	}

	httpx.OK(c, gin.H{"checkins": items})
}
