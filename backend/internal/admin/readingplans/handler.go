package readingplans

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

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
}

type Plan struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	ImageURL     string    `json:"imageUrl"`
	DurationDays int       `json:"durationDays"`
	IsActive     bool      `json:"isActive"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Days         []PlanDay `json:"days"`
}

type UpsertRequest struct {
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	ImageURL     string    `json:"imageUrl"`
	DurationDays int       `json:"durationDays"`
	IsActive     bool      `json:"isActive"`
	Days         []PlanDay `json:"days"`
}

func NewHandler(db *pgxpool.Pool) Handler {
	return Handler{db: db}
}

func planID() string {
	return "plan-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func planDayID(planID string, dayNumber int) string {
	return planID + "-day-" + strconv.Itoa(dayNumber)
}

func (h Handler) List(c *gin.Context) {
	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT id, title, description, image_url, duration_days, is_active, created_at, updated_at
			FROM reading_plans
			ORDER BY created_at DESC
		`,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_plans_failed", "failed to load reading plans")
		return
	}
	defer rows.Close()

	items := make([]Plan, 0)
	for rows.Next() {
		var item Plan
		if err := rows.Scan(&item.ID, &item.Title, &item.Description, &item.ImageURL, &item.DurationDays, &item.IsActive, &item.CreatedAt, &item.UpdatedAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "reading_plans_failed", "failed to load reading plans")
			return
		}
		item.Days = make([]PlanDay, 0)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_plans_failed", "failed to load reading plans")
		return
	}

	for idx := range items {
		days, err := h.planDays(c.Request.Context(), items[idx].ID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "reading_plans_failed", "failed to load reading plans")
			return
		}
		items[idx].Days = days
	}

	httpx.OK(c, gin.H{"plans": items})
}

func (h Handler) Create(c *gin.Context) {
	var req UpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	item, err := h.save(c.Request.Context(), "", req)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}

	httpx.Created(c, gin.H{"plan": item})
}

func (h Handler) Update(c *gin.Context) {
	var req UpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid reading plan id is required")
		return
	}

	item, err := h.save(c.Request.Context(), id, req)
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			httpx.Error(c, http.StatusNotFound, "reading_plan_not_found", "reading plan not found")
		default:
			httpx.Error(c, http.StatusBadRequest, "invalid_input", err.Error())
		}
		return
	}

	httpx.OK(c, gin.H{"plan": item})
}

func (h Handler) Delete(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid reading plan id is required")
		return
	}

	result, err := h.db.Exec(c.Request.Context(), `DELETE FROM reading_plans WHERE id = $1`, id)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "reading_plan_delete_failed", "failed to delete reading plan")
		return
	}
	if result.RowsAffected() == 0 {
		httpx.Error(c, http.StatusNotFound, "reading_plan_not_found", "reading plan not found")
		return
	}

	c.Status(http.StatusNoContent)
}

func (h Handler) save(ctx context.Context, id string, req UpsertRequest) (Plan, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	if req.Title == "" || req.Description == "" || len(req.Days) == 0 {
		return Plan{}, errors.New("title, description, and at least one plan day are required")
	}

	req.DurationDays = len(req.Days)

	for idx := range req.Days {
		req.Days[idx].DayNumber = idx + 1
		req.Days[idx].Title = strings.TrimSpace(req.Days[idx].Title)
		req.Days[idx].Reference = strings.TrimSpace(req.Days[idx].Reference)
		req.Days[idx].Description = strings.TrimSpace(req.Days[idx].Description)
		req.Days[idx].PrayerPrompt = strings.TrimSpace(req.Days[idx].PrayerPrompt)

		if req.Days[idx].Title == "" || req.Days[idx].Reference == "" {
			return Plan{}, errors.New("each reading plan day needs a title and scripture reference")
		}
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		return Plan{}, err
	}
	defer tx.Rollback(ctx)

	if id == "" {
		id = planID()
		_, err = tx.Exec(
			ctx,
			`
				INSERT INTO reading_plans (id, title, description, image_url, duration_days, is_active)
				VALUES ($1, $2, $3, $4, $5, $6)
			`,
			id,
			req.Title,
			req.Description,
			req.ImageURL,
			req.DurationDays,
			req.IsActive,
		)
	} else {
		result, execErr := tx.Exec(
			ctx,
			`
				UPDATE reading_plans
				SET title = $2,
				    description = $3,
				    image_url = $4,
				    duration_days = $5,
				    is_active = $6,
				    updated_at = NOW()
				WHERE id = $1
			`,
			id,
			req.Title,
			req.Description,
			req.ImageURL,
			req.DurationDays,
			req.IsActive,
		)
		if execErr != nil {
			err = execErr
		} else if result.RowsAffected() == 0 {
			err = pgx.ErrNoRows
		}
	}
	if err != nil {
		return Plan{}, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM reading_plan_days WHERE plan_id = $1`, id); err != nil {
		return Plan{}, err
	}

	for _, day := range req.Days {
		if _, err := tx.Exec(
			ctx,
			`
				INSERT INTO reading_plan_days (
					id,
					plan_id,
					day_number,
					title,
					reference,
					description,
					prayer_prompt
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`,
			planDayID(id, day.DayNumber),
			id,
			day.DayNumber,
			day.Title,
			day.Reference,
			day.Description,
			day.PrayerPrompt,
		); err != nil {
			return Plan{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Plan{}, err
	}

	return h.find(ctx, id)
}

func (h Handler) find(ctx context.Context, id string) (Plan, error) {
	var item Plan
	err := h.db.QueryRow(
		ctx,
		`
			SELECT id, title, description, image_url, duration_days, is_active, created_at, updated_at
			FROM reading_plans
			WHERE id = $1
			LIMIT 1
		`,
		id,
	).Scan(&item.ID, &item.Title, &item.Description, &item.ImageURL, &item.DurationDays, &item.IsActive, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return Plan{}, err
	}

	days, err := h.planDays(ctx, id)
	if err != nil {
		return Plan{}, err
	}
	item.Days = days
	return item, nil
}

func (h Handler) planDays(ctx context.Context, planID string) ([]PlanDay, error) {
	rows, err := h.db.Query(
		ctx,
		`
			SELECT id, day_number, title, reference, description, prayer_prompt
			FROM reading_plan_days
			WHERE plan_id = $1
			ORDER BY day_number ASC
		`,
		planID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	days := make([]PlanDay, 0)
	for rows.Next() {
		var day PlanDay
		if err := rows.Scan(&day.ID, &day.DayNumber, &day.Title, &day.Reference, &day.Description, &day.PrayerPrompt); err != nil {
			return nil, err
		}
		days = append(days, day)
	}
	return days, rows.Err()
}
