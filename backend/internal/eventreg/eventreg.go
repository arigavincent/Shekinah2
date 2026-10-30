// Package eventreg handles signing up for events: no registration, the
// church's own form (questions set per event), or an outside form link such
// as Google Forms. Events can be free or paid; a paid registration becomes a
// ticket once finance confirms the payment.
package eventreg

import (
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/auth"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) Handler { return Handler{db: db} }

// Field is one question on an event's form.
type Field struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Type     string   `json:"type"` // text, longtext, phone, email, number, choice
	Required bool     `json:"required"`
	Options  []string `json:"options,omitempty"`
}

type Setup struct {
	Mode     string  `json:"mode"` // none, form, link
	FormURL  string  `json:"formUrl"`
	Fields   []Field `json:"fields"`
	Price    int     `json:"price"`
	Capacity int     `json:"capacity"`
}

type Mine struct {
	Registered bool              `json:"registered"`
	Ticket     string            `json:"ticket,omitempty"`
	Answers    map[string]string `json:"answers,omitempty"`
	// none (free or not yet paid), pending (code sent, being checked), paid
	Payment string `json:"payment"`
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (h Handler) setup(c *gin.Context, eventID string) (Setup, string, error) {
	var s Setup
	var raw []byte
	var title string
	admin := strings.Contains(c.FullPath(), "/admin/")
	err := h.db.QueryRow(c.Request.Context(), `SELECT title, registration, form_url, form_fields, price, capacity FROM events WHERE id = $1 AND ($2 OR (is_published AND published_at<=NOW()))`, eventID, admin).
		Scan(&title, &s.Mode, &s.FormURL, &raw, &s.Price, &s.Capacity)
	if err != nil {
		return s, "", err
	}
	_ = json.Unmarshal(raw, &s.Fields)
	if s.Fields == nil {
		s.Fields = []Field{}
	}
	return s, title, nil
}

func (h Handler) count(c *gin.Context, eventID string) int {
	var n int
	_ = h.db.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM event_registrations WHERE event_id = $1`, eventID).Scan(&n)
	return n
}

func (h Handler) mine(c *gin.Context, eventID, userID string, price int) Mine {
	m := Mine{Payment: "none"}
	if userID == "" {
		return m
	}
	var raw []byte
	err := h.db.QueryRow(c.Request.Context(), `SELECT ticket, answers FROM event_registrations WHERE event_id = $1 AND user_id::text = $2`, eventID, userID).Scan(&m.Ticket, &raw)
	if err == nil {
		m.Registered = true
		_ = json.Unmarshal(raw, &m.Answers)
	}
	if price > 0 {
		var status string
		_ = h.db.QueryRow(c.Request.Context(), `SELECT status FROM giving_transactions WHERE item_id = $1 AND user_id::text = $2 AND status IN ('success','awaiting_verification')
			ORDER BY status = 'success' DESC LIMIT 1`, eventID, userID).Scan(&status)
		switch status {
		case "success":
			m.Payment = "paid"
		case "awaiting_verification":
			m.Payment = "pending"
		}
		// The ticket only counts once paid.
		if m.Payment != "paid" {
			m.Ticket = ""
		}
	}
	return m
}

// GET /events/:id/registration — how to sign up, spots left, and my status.
func (h Handler) Get(c *gin.Context) {
	eventID := c.Param("id")
	s, _, err := h.setup(c, eventID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	userID, _ := auth.UserIDFromContext(c)
	taken := h.count(c, eventID)
	left := -1
	if s.Capacity > 0 {
		left = max(s.Capacity-taken, 0)
	}
	c.JSON(http.StatusOK, gin.H{"setup": s, "registered": taken, "spotsLeft": left, "mine": h.mine(c, eventID, userID, s.Price)})
}

// POST /events/:id/register {"answers": {...}} — signs the member up (or
// updates their answers). A paid event then needs its payment.
func (h Handler) Register(c *gin.Context) {
	eventID := c.Param("id")
	userID, _ := auth.UserIDFromContext(c)
	s, _, err := h.setup(c, eventID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	if s.Mode != "form" && s.Mode != "link" && !(s.Mode == "none" && s.Price > 0) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "This event doesn't take registrations in the app"})
		return
	}
	var req struct {
		Answers map[string]string `json:"answers"`
	}
	_ = c.ShouldBindJSON(&req)
	answers := map[string]string{}
	for _, f := range s.Fields {
		if s.Mode != "form" {
			break
		}
		v := strings.TrimSpace(req.Answers[f.ID])
		if len(v) > 2000 {
			v = v[:2000]
		}
		if f.Required && v == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Please answer: " + f.Label})
			return
		}
		if v != "" && f.Type == "choice" && len(f.Options) > 0 {
			ok := false
			for _, o := range f.Options {
				ok = ok || o == v
			}
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"message": "Choose one of the options for: " + f.Label})
				return
			}
		}
		answers[f.ID] = v
	}
	raw, _ := json.Marshal(answers)
	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not register"})
		return
	}
	defer tx.Rollback(ctx)
	// Lock the event so the last spots can't be taken twice.
	if _, err := tx.Exec(ctx, `SELECT 1 FROM events WHERE id = $1 FOR UPDATE`, eventID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not register"})
		return
	}
	var exists bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM event_registrations WHERE event_id = $1 AND user_id::text = $2)`, eventID, userID).Scan(&exists)
	if exists {
		_, err = tx.Exec(ctx, `UPDATE event_registrations SET answers = $3, updated_at = NOW() WHERE event_id = $1 AND user_id::text = $2`, eventID, userID, raw)
	} else {
		var taken int
		_ = tx.QueryRow(ctx, `SELECT COUNT(*) FROM event_registrations WHERE event_id = $1`, eventID).Scan(&taken)
		if s.Capacity > 0 && taken >= s.Capacity {
			c.JSON(http.StatusConflict, gin.H{"message": "Sorry, this event is full."})
			return
		}
		ticket := strings.ToUpper(randomHex(4))
		_, err = tx.Exec(ctx, `INSERT INTO event_registrations (id, event_id, user_id, answers, ticket) VALUES ($1, $2, $3, $4, $5)`,
			"reg-"+randomHex(6), eventID, userID, raw, ticket)
	}
	if err != nil || tx.Commit(ctx) != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not register"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"mine": h.mine(c, eventID, userID, s.Price)})
}

// DELETE /events/:id/register — cancels, unless already paid.
func (h Handler) Cancel(c *gin.Context) {
	eventID := c.Param("id")
	userID, _ := auth.UserIDFromContext(c)
	s, _, err := h.setup(c, eventID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	if m := h.mine(c, eventID, userID, s.Price); m.Payment != "none" {
		c.JSON(http.StatusConflict, gin.H{"message": "You've paid for this event. Contact the church office to cancel."})
		return
	}
	_, _ = h.db.Exec(c.Request.Context(), `DELETE FROM event_registrations WHERE event_id = $1 AND user_id::text = $2`, eventID, userID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PUT /admin/events/:id/registration — how people sign up for this event.
func (h Handler) AdminSetup(c *gin.Context) {
	var s Setup
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid setup"})
		return
	}
	var err error
	s, err = NormalizeSetup(s)
	if err != nil {
		c.JSON(400, gin.H{"message": err.Error()})
		return
	}
	clean := s.Fields

	raw, _ := json.Marshal(clean)
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE events SET registration = $2, form_url = $3, form_fields = $4, price = $5, capacity = $6, updated_at = NOW() WHERE id = $1`,
		c.Param("id"), s.Mode, s.FormURL, raw, s.Price, s.Capacity)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	s.Fields = clean
	c.JSON(http.StatusOK, gin.H{"setup": s})
}

type Row struct {
	Name       string            `json:"name"`
	Email      string            `json:"email"`
	Answers    map[string]string `json:"answers"`
	Ticket     string            `json:"ticket"`
	Payment    string            `json:"payment"`
	Registered time.Time         `json:"registered"`
}

func (h Handler) rows(c *gin.Context, eventID string) ([]Row, error) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT u.name, u.email, r.answers, r.ticket, r.created_at,
			COALESCE((SELECT g.status FROM giving_transactions g WHERE g.item_id = r.event_id AND g.user_id = r.user_id AND g.status IN ('success','awaiting_verification') ORDER BY g.status = 'success' DESC LIMIT 1), '')
		FROM event_registrations r JOIN users u ON u.id = r.user_id
		WHERE r.event_id = $1 ORDER BY r.created_at`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Row, 0)
	for rows.Next() {
		var r Row
		var raw []byte
		var pay string
		if err := rows.Scan(&r.Name, &r.Email, &raw, &r.Ticket, &r.Registered, &pay); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &r.Answers)
		r.Payment = map[string]string{"success": "paid", "awaiting_verification": "pending"}[pay]
		if r.Payment == "" {
			r.Payment = "none"
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// GET /admin/events/:id/registrations — everyone signed up, with answers.
func (h Handler) AdminList(c *gin.Context) {
	s, title, err := h.setup(c, c.Param("id"))
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	list, err := h.rows(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load registrations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"title": title, "setup": s, "registrations": list})
}

// GET /admin/events/:id/registrations.csv — the same, as a spreadsheet.
func (h Handler) AdminCSV(c *gin.Context) {
	s, title, err := h.setup(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	list, err := h.rows(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load registrations"})
		return
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", "registrations-"+strings.ReplaceAll(strings.ToLower(title), " ", "-")+".csv"))
	w := csv.NewWriter(c.Writer)
	head := []string{"Name", "Email", "Registered", "Ticket", "Payment"}
	for _, f := range s.Fields {
		head = append(head, f.Label)
	}
	_ = w.Write(head)
	for _, r := range list {
		line := []string{r.Name, r.Email, r.Registered.Format("2006-01-02 15:04"), r.Ticket, r.Payment}
		for _, f := range s.Fields {
			line = append(line, r.Answers[f.ID])
		}
		_ = w.Write(line)
	}
	w.Flush()
}

// NormalizeSetup is shared by atomic event creation and later registration edits.
func NormalizeSetup(s Setup) (Setup, error) {
	if s.Mode != "none" && s.Mode != "form" && s.Mode != "link" {
		return s, errors.New("registration must be none, form or link")
	}
	s.FormURL = strings.TrimSpace(s.FormURL)
	if s.Mode == "link" {
		u, e := url.Parse(s.FormURL)
		if e != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
			return s, errors.New("use the full HTTPS form link")
		}
	}
	if s.Price < 0 || s.Price > 1_000_000 || s.Capacity < 0 || s.Capacity > 1_000_000 {
		return s, errors.New("check price and capacity")
	}
	clean := []Field{}
	ids := map[string]bool{}
	if s.Mode == "form" {
		for _, f := range s.Fields {
			f.Label = strings.TrimSpace(f.Label)
			if f.Label == "" {
				continue
			}
			if len(clean) >= 30 {
				return s, errors.New("use at most 30 questions")
			}
			if f.ID == "" {
				f.ID = "q" + randomHex(3)
			}
			if ids[f.ID] {
				return s, errors.New("question identifiers must be unique")
			}
			ids[f.ID] = true
			switch f.Type {
			case "text", "longtext", "phone", "email", "number", "choice":
			default:
				f.Type = "text"
			}
			options := []string{}
			for _, o := range f.Options {
				if o = strings.TrimSpace(o); o != "" {
					options = append(options, o)
				}
			}
			f.Options = options
			if f.Type == "choice" && len(options) == 0 {
				return s, errors.New("add choices for " + f.Label)
			}
			clean = append(clean, f)
		}
	}
	s.Fields = clean
	return s, nil
}
