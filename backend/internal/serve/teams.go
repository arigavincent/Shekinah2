package serve

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/auth"
	mailer "github.com/ariga/shekinah-backend/internal/mail"
)

// Teams: the places to serve (each with the leader who receives requests),
// and members' requests to join them, emailed to that leader.
type Teams struct{ db *pgxpool.Pool }

func NewTeams(db *pgxpool.Pool) Teams { return Teams{db: db} }

type Team struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	LeaderName  string `json:"leaderName"`
	LeaderEmail string `json:"leaderEmail,omitempty"`
	LeaderPhone string `json:"leaderPhone,omitempty"`
	SortOrder   int    `json:"sortOrder"`
	IsActive    bool   `json:"isActive"`
	Members     int    `json:"members"`
}

const contactKey = "serve_contact_email"

func (t Teams) list(ctx context.Context, all bool) ([]Team, error) {
	rows, err := t.db.Query(ctx, `
		SELECT id, name, description, icon, leader_name, leader_email, leader_phone, sort_order, is_active,
			(SELECT COUNT(*) FROM serve_requests r WHERE r.team_id = t.id AND r.status = 'placed')
		FROM serve_teams t WHERE is_active OR $1 ORDER BY sort_order, name`, all)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Team, 0)
	for rows.Next() {
		var x Team
		if err := rows.Scan(&x.ID, &x.Name, &x.Description, &x.Icon, &x.LeaderName, &x.LeaderEmail, &x.LeaderPhone, &x.SortOrder, &x.IsActive, &x.Members); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// GET /serve/teams — the teams, with my pending or accepted requests.
func (t Teams) List(c *gin.Context) {
	teams, err := t.list(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load teams"})
		return
	}
	// Members don't need the leaders' contact details.
	for i := range teams {
		teams[i].LeaderEmail, teams[i].LeaderPhone = "", ""
	}
	mine := map[string]string{}
	if userID, ok := auth.UserIDFromContext(c); ok {
		rows, err := t.db.Query(c.Request.Context(), `SELECT DISTINCT ON (team_id) team_id, status FROM serve_requests WHERE user_id::text = $1 ORDER BY team_id, created_at DESC`, userID)
		if err == nil {
			for rows.Next() {
				var team, status string
				if rows.Scan(&team, &status) == nil {
					mine[team] = status
				}
			}
			rows.Close()
		}
	}
	c.JSON(http.StatusOK, gin.H{"teams": teams, "mine": mine})
}

// POST /serve/requests {"teamId", "phone", "availability", "message"}
func (t Teams) Request(c *gin.Context) {
	userID, _ := auth.UserIDFromContext(c)
	var req struct {
		TeamID       string `json:"teamId"`
		Phone        string `json:"phone"`
		Availability string `json:"availability"`
		Message      string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.TeamID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Choose a team"})
		return
	}
	clip := func(s string, n int) string {
		s = strings.TrimSpace(s)
		if len(s) > n {
			s = s[:n]
		}
		return s
	}
	phone, availability, message := clip(req.Phone, 30), clip(req.Availability, 200), clip(req.Message, 2000)
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Add a phone number so the team leader can reach you"})
		return
	}
	ctx := c.Request.Context()
	var team Team
	if err := t.db.QueryRow(ctx, `SELECT id, name, leader_name, leader_email FROM serve_teams WHERE id = $1 AND is_active`, req.TeamID).
		Scan(&team.ID, &team.Name, &team.LeaderName, &team.LeaderEmail); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Team not found"})
		return
	}
	var pending bool
	_ = t.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM serve_requests WHERE team_id = $1 AND user_id::text = $2 AND status IN ('new','contacted','placed'))`, team.ID, userID).Scan(&pending)
	if pending {
		c.JSON(http.StatusConflict, gin.H{"message": "You've already asked to serve with " + team.Name + ". The team leader will be in touch."})
		return
	}
	var name, email string
	_ = t.db.QueryRow(ctx, `SELECT name, email FROM users WHERE id = $1`, userID).Scan(&name, &email)
	id := "srv-" + randomHex(6)
	if _, err := t.db.Exec(ctx, `INSERT INTO serve_requests (id, team_id, user_id, phone, availability, message) VALUES ($1, $2, $3, $4, $5, $6)`,
		id, team.ID, userID, phone, availability, message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not send your request"})
		return
	}
	// Tell the team leader by email (or the serve coordinator, or the admins).
	to := t.recipients(ctx, team.LeaderEmail)
	go func() {
		err := mailer.Send(mailer.Message{
			To:      to,
			ReplyTo: email,
			Subject: name + " would like to serve in " + team.Name,
			Heading: "A new request to serve",
			Intro:   name + " asked to join the " + team.Name + " team through the Shekinah Sons Global app. Reply to this email or call to welcome them.",
			Rows: []mailer.Row{
				{Label: "Name", Value: name}, {Label: "Email", Value: email}, {Label: "Phone", Value: phone},
				{Label: "Team", Value: team.Name}, {Label: "Available", Value: orDash(availability)}, {Label: "Message", Value: orDash(message)},
				{Label: "Sent", Value: time.Now().Format("Mon 2 Jan 2006, 3:04 PM")},
			},
			Footer: "You can see every request and mark it as contacted in the admin console under More > Serve.",
		})
		if err == nil && mailer.Configured() {
			_, _ = t.db.Exec(context.Background(), `UPDATE serve_requests SET emailed = TRUE WHERE id = $1`, id)
		} else if err != nil {
			log.Printf("serve request %s: email failed: %v", id, err)
		}
	}()
	c.JSON(http.StatusCreated, gin.H{"id": id, "team": team.Name, "leader": team.LeaderName})
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

func (t Teams) recipients(ctx context.Context, leader string) []string {
	if leader != "" {
		return []string{leader}
	}
	var contact string
	_ = t.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = $1`, contactKey).Scan(&contact)
	if contact != "" {
		return []string{contact}
	}
	out := []string{}
	rows, err := t.db.Query(ctx, `SELECT email FROM users WHERE role IN ('admin','super_admin') AND is_active`)
	if err == nil {
		for rows.Next() {
			var e string
			if rows.Scan(&e) == nil {
				out = append(out, e)
			}
		}
		rows.Close()
	}
	return out
}

// ---- Admin ----

// GET /admin/serve — teams (with leaders), requests and the fallback email.
func (t Teams) AdminOverview(c *gin.Context) {
	ctx := c.Request.Context()
	teams, err := t.list(ctx, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load"})
		return
	}
	type reqRow struct {
		ID           string    `json:"id"`
		Team         string    `json:"team"`
		TeamID       string    `json:"teamId"`
		Name         string    `json:"name"`
		Email        string    `json:"email"`
		Phone        string    `json:"phone"`
		Availability string    `json:"availability"`
		Message      string    `json:"message"`
		Status       string    `json:"status"`
		Emailed      bool      `json:"emailed"`
		CreatedAt    time.Time `json:"createdAt"`
	}
	rows, err := t.db.Query(ctx, `SELECT r.id, t.name, t.id, u.name, u.email, r.phone, r.availability, r.message, r.status, r.emailed, r.created_at
		FROM serve_requests r JOIN serve_teams t ON t.id = r.team_id JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 300`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load"})
		return
	}
	defer rows.Close()
	reqs := make([]reqRow, 0)
	for rows.Next() {
		var r reqRow
		if rows.Scan(&r.ID, &r.Team, &r.TeamID, &r.Name, &r.Email, &r.Phone, &r.Availability, &r.Message, &r.Status, &r.Emailed, &r.CreatedAt) == nil {
			reqs = append(reqs, r)
		}
	}
	var contact string
	_ = t.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = $1`, contactKey).Scan(&contact)
	c.JSON(http.StatusOK, gin.H{"teams": teams, "requests": reqs, "contactEmail": contact, "emailReady": mailer.Configured()})
}

func validEmail(s string) bool {
	if s == "" {
		return true
	}
	_, err := mail.ParseAddress(s)
	return err == nil
}

// PUT /admin/serve/teams/:id (create or update) and DELETE /admin/serve/teams/:id
func (t Teams) AdminSaveTeam(c *gin.Context) {
	var x Team
	if err := c.ShouldBindJSON(&x); err != nil || strings.TrimSpace(x.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Give the team a name"})
		return
	}
	x.LeaderEmail = strings.TrimSpace(x.LeaderEmail)
	if !validEmail(x.LeaderEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Check the leader's email address"})
		return
	}
	id := c.Param("id")
	if id == "new" {
		id = "team-" + randomHex(4)
	}
	_, err := t.db.Exec(c.Request.Context(), `
		INSERT INTO serve_teams (id, name, description, icon, leader_name, leader_email, leader_phone, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET name = $2, description = $3, icon = $4, leader_name = $5, leader_email = $6, leader_phone = $7,
			sort_order = $8, is_active = $9, updated_at = NOW()`,
		id, strings.TrimSpace(x.Name), strings.TrimSpace(x.Description), x.Icon, strings.TrimSpace(x.LeaderName), x.LeaderEmail, strings.TrimSpace(x.LeaderPhone), x.SortOrder, x.IsActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not save the team"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func (t Teams) AdminDeleteTeam(c *gin.Context) {
	_, _ = t.db.Exec(c.Request.Context(), `DELETE FROM serve_teams WHERE id = $1`, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PATCH /admin/serve/requests/:id {"status": "contacted" | "placed" | "declined"}
func (t Teams) AdminUpdateRequest(c *gin.Context) {
	var req struct {
		Status string `json:"status"`
	}
	_ = c.ShouldBindJSON(&req)
	switch req.Status {
	case "new", "contacted", "placed", "declined":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"message": "Unknown status"})
		return
	}
	tag, err := t.db.Exec(c.Request.Context(), `UPDATE serve_requests SET status = $2, updated_at = NOW() WHERE id = $1`, c.Param("id"), req.Status)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Request not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PUT /admin/serve/contact {"email"} — who gets requests for teams without a leader email.
func (t Teams) AdminSetContact(c *gin.Context) {
	var req struct {
		Email string `json:"email"`
	}
	_ = c.ShouldBindJSON(&req)
	req.Email = strings.TrimSpace(req.Email)
	if !validEmail(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Check the email address"})
		return
	}
	_, err := t.db.Exec(c.Request.Context(), `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, contactKey, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not save"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"email": req.Email})
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
