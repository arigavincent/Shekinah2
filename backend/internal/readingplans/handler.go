package readingplans

import (
	"context"
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

type PlanDay struct {
	ID           string `json:"id"`
	DayNumber    int    `json:"dayNumber"`
	Title        string `json:"title"`
	Reference    string `json:"reference"`
	Description  string `json:"description"`
	PrayerPrompt string `json:"prayerPrompt"`
	Completed    bool   `json:"completed"`
	Note         string `json:"note,omitempty"`
}

type Plan struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	ImageURL      string    `json:"imageUrl"`
	DurationDays  int       `json:"durationDays"`
	IsActive      bool      `json:"isActive"`
	CompletedDays int       `json:"completedDays"`
	StreakDays    int       `json:"streakDays,omitempty"`
	ReminderOn    bool      `json:"reminderOn,omitempty"`
	ReminderTime  string    `json:"reminderTime,omitempty"`
	Days          []PlanDay `json:"days,omitempty"`
}

type NoteRequest struct {
	Note string `json:"note"`
}

type ReminderRequest struct {
	Enabled      bool   `json:"enabled"`
	ReminderTime string `json:"reminderTime"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func progressID(planID string, day int) string {
	return "rprog-" + planID + "-" + strconv.Itoa(day) + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func currentUserID(c *gin.Context) string {
	userID, _ := auth.UserIDFromContext(c)
	return userID
}

func (h Handler) List(c *gin.Context) {
	userID := currentUserID(c)

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				p.id,
				p.title,
				p.description,
				p.image_url,
				p.duration_days,
				p.is_active,
				COALESCE(COUNT(DISTINCT r.day_number), 0) AS completed_days
			FROM reading_plans p
			LEFT JOIN reading_plan_progress r
			  ON r.plan_id = p.id
			 AND r.user_id = NULLIF($1, '')::uuid
			WHERE p.is_active = TRUE
			GROUP BY p.id
			ORDER BY p.created_at DESC
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_plans_failed", "failed to load reading plans")
		return
	}
	defer rows.Close()

	plans := make([]Plan, 0)
	for rows.Next() {
		var item Plan
		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.Description,
			&item.ImageURL,
			&item.DurationDays,
			&item.IsActive,
			&item.CompletedDays,
		); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "reading_plans_failed", "failed to load reading plans")
			return
		}

		plans = append(plans, item)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_plans_failed", "failed to load reading plans")
		return
	}

	if userID != "" {
		for idx := range plans {
			plans[idx].StreakDays = h.streakDays(c.Request.Context(), userID, plans[idx].ID)
		}
	}

	httpx.OK(c, gin.H{"plans": plans})
}

func (h Handler) Detail(c *gin.Context) {
	planID := strings.TrimSpace(c.Param("id"))
	if planID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid plan id is required")
		return
	}

	userID := currentUserID(c)

	var plan Plan
	err := h.db.QueryRow(
		c.Request.Context(),
		`
			SELECT
				p.id,
				p.title,
				p.description,
				p.image_url,
				p.duration_days,
				p.is_active,
				COALESCE(COUNT(DISTINCT r.day_number), 0) AS completed_days
			FROM reading_plans p
			LEFT JOIN reading_plan_progress r
			  ON r.plan_id = p.id
			 AND r.user_id = NULLIF($2, '')::uuid
			WHERE p.id = $1
			  AND p.is_active = TRUE
			GROUP BY p.id
			LIMIT 1
		`,
		planID,
		userID,
	).Scan(
		&plan.ID,
		&plan.Title,
		&plan.Description,
		&plan.ImageURL,
		&plan.DurationDays,
		&plan.IsActive,
		&plan.CompletedDays,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "reading_plan_not_found", "reading plan not found")
			return
		}

		httpx.Error(c, http.StatusInternalServerError, "reading_plan_failed", "failed to load reading plan")
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT
				d.id,
				d.day_number,
				d.title,
				d.reference,
				d.description,
				d.prayer_prompt,
				CASE WHEN r.user_id IS NULL THEN FALSE ELSE TRUE END AS completed,
				COALESCE(n.note, '') AS note
			FROM reading_plan_days d
			LEFT JOIN reading_plan_progress r
			  ON r.plan_id = d.plan_id
			 AND r.day_number = d.day_number
			 AND r.user_id = NULLIF($2, '')::uuid
			LEFT JOIN reading_plan_notes n
			  ON n.plan_id = d.plan_id
			 AND n.day_number = d.day_number
			 AND n.user_id = NULLIF($2, '')::uuid
			WHERE d.plan_id = $1
			ORDER BY d.day_number ASC
		`,
		planID,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_plan_failed", "failed to load reading plan")
		return
	}
	defer rows.Close()

	plan.Days = make([]PlanDay, 0)
	for rows.Next() {
		var day PlanDay
		if err := rows.Scan(
			&day.ID,
			&day.DayNumber,
			&day.Title,
			&day.Reference,
			&day.Description,
			&day.PrayerPrompt,
			&day.Completed,
			&day.Note,
		); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "reading_plan_failed", "failed to load reading plan")
			return
		}

		plan.Days = append(plan.Days, day)
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_plan_failed", "failed to load reading plan")
		return
	}

	if userID != "" {
		plan.StreakDays = h.streakDays(c.Request.Context(), userID, plan.ID)

		var reminderEnabled bool
		var reminderTime string
		err = h.db.QueryRow(
			c.Request.Context(),
			`
				SELECT enabled, reminder_time
				FROM reading_plan_reminders
				WHERE plan_id = $1 AND user_id = $2
				LIMIT 1
			`,
			planID,
			userID,
		).Scan(&reminderEnabled, &reminderTime)
		if err == nil {
			plan.ReminderOn = reminderEnabled
			plan.ReminderTime = reminderTime
		}
	}

	httpx.OK(c, gin.H{"plan": plan})
}

func (h Handler) CompleteDay(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	planID := strings.TrimSpace(c.Param("id"))
	dayValue := strings.TrimSpace(c.Param("day"))
	dayNumber, err := strconv.Atoi(dayValue)
	if planID == "" || err != nil || dayNumber <= 0 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid plan id and day number are required")
		return
	}

	result, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO reading_plan_progress (
				id,
				plan_id,
				user_id,
				day_number
			)
			SELECT $1, $2, $3, $4
			WHERE EXISTS (
				SELECT 1
				FROM reading_plan_days d
				JOIN reading_plans p ON p.id = d.plan_id
				WHERE d.plan_id = $2
				  AND d.day_number = $4
				  AND p.is_active = TRUE
			)
			ON CONFLICT (plan_id, user_id, day_number)
			DO UPDATE SET updated_at = NOW(), completed_at = NOW()
		`,
		progressID(planID, dayNumber),
		planID,
		userID,
		dayNumber,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_progress_failed", "failed to save reading progress")
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "reading_plan_day_not_found", "active reading plan day not found")
		return
	}

	httpx.OK(c, gin.H{"planId": planID, "dayNumber": dayNumber, "completed": true})
}

func (h Handler) SaveNote(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	planID := strings.TrimSpace(c.Param("id"))
	dayValue := strings.TrimSpace(c.Param("day"))
	dayNumber, err := strconv.Atoi(dayValue)
	if planID == "" || err != nil || dayNumber <= 0 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid plan id and day number are required")
		return
	}

	var req NoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid note payload")
		return
	}

	note := strings.TrimSpace(req.Note)
	if len(note) > 4000 {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "note is too long")
		return
	}

	result, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO reading_plan_notes (id, plan_id, user_id, day_number, note)
			SELECT $1, $2, $3, $4, $5
			WHERE EXISTS (
				SELECT 1
				FROM reading_plan_days d
				JOIN reading_plans p ON p.id = d.plan_id
				WHERE d.plan_id = $2
				  AND d.day_number = $4
				  AND p.is_active = TRUE
			)
			ON CONFLICT (plan_id, user_id, day_number)
			DO UPDATE SET note = EXCLUDED.note, updated_at = NOW()
		`,
		progressID(planID+"-note", dayNumber),
		planID,
		userID,
		dayNumber,
		note,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_note_failed", "failed to save reading note")
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "reading_plan_day_not_found", "active reading plan day not found")
		return
	}

	httpx.OK(c, gin.H{"planId": planID, "dayNumber": dayNumber, "note": note})
}

func (h Handler) UpdateReminder(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	planID := strings.TrimSpace(c.Param("id"))
	if planID == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid plan id is required")
		return
	}

	var req ReminderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid reminder payload")
		return
	}

	reminderTime := strings.TrimSpace(req.ReminderTime)
	if reminderTime == "" {
		reminderTime = "06:00"
	}
	if _, err := time.Parse("15:04", reminderTime); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "reminder time must look like 06:00")
		return
	}

	result, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO reading_plan_reminders (id, plan_id, user_id, enabled, reminder_time)
			SELECT $1, $2, $3, $4, $5
			WHERE EXISTS (
				SELECT 1 FROM reading_plans WHERE id = $2 AND is_active = TRUE
			)
			ON CONFLICT (plan_id, user_id)
			DO UPDATE SET enabled = EXCLUDED.enabled, reminder_time = EXCLUDED.reminder_time, updated_at = NOW()
		`,
		"reminder-"+planID+"-"+userID,
		planID,
		userID,
		req.Enabled,
		reminderTime,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_reminder_failed", "failed to save reading reminder")
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "reading_plan_not_found", "active reading plan not found")
		return
	}

	httpx.OK(c, gin.H{"planId": planID, "enabled": req.Enabled, "reminderTime": reminderTime})
}

func (h Handler) streakDays(ctx context.Context, userID string, planID string) int {
	rows, err := h.db.Query(
		ctx,
		`
			SELECT DISTINCT completed_at::date
			FROM reading_plan_progress
			WHERE user_id = $1
			  AND plan_id = $2
			ORDER BY completed_at::date DESC
		`,
		userID,
		planID,
	)
	if err != nil {
		return 0
	}
	defer rows.Close()

	dates := make([]time.Time, 0)
	for rows.Next() {
		var day time.Time
		if err := rows.Scan(&day); err != nil {
			return 0
		}
		dates = append(dates, day.UTC())
	}

	if len(dates) == 0 {
		return 0
	}

	streak := 1
	for idx := 1; idx < len(dates); idx++ {
		if dates[idx-1].Sub(dates[idx]).Hours() > 36 || dates[idx-1].Sub(dates[idx]).Hours() < 12 {
			break
		}
		streak++
	}
	return streak
}
