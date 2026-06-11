package readingplans

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

type PlanDay struct {
	ID           string `json:"id"`
	DayNumber    int    `json:"dayNumber"`
	Title        string `json:"title"`
	Reference    string `json:"reference"`
	Description  string `json:"description"`
	PrayerPrompt string `json:"prayerPrompt"`
	Completed    bool   `json:"completed"`
}

type Plan struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	ImageURL      string    `json:"imageUrl"`
	DurationDays  int       `json:"durationDays"`
	IsActive      bool      `json:"isActive"`
	CompletedDays int       `json:"completedDays"`
	Days          []PlanDay `json:"days,omitempty"`
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
			 AND ($1 <> '' AND r.user_id = $1)
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
			 AND ($2 <> '' AND r.user_id = $2)
			WHERE p.id = $1
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
				CASE WHEN r.user_id IS NULL THEN FALSE ELSE TRUE END AS completed
			FROM reading_plan_days d
			LEFT JOIN reading_plan_progress r
			  ON r.plan_id = d.plan_id
			 AND r.day_number = d.day_number
			 AND ($2 <> '' AND r.user_id = $2)
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

	_, err = h.db.Exec(
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
				SELECT 1 FROM reading_plan_days WHERE plan_id = $2 AND day_number = $4
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

	httpx.OK(c, gin.H{"planId": planID, "dayNumber": dayNumber, "completed": true})
}
