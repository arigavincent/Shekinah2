// Package mygroups: what a member sees of the groups they belong to, and,
// for leaders and assistants, who is in their group.
package mygroups

import (
	"net/http"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) Handler { return Handler{db: db} }

type Group struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Role        string `json:"role"`
	Schedule    string `json:"schedule"`
	Location    string `json:"location"`
	LeaderName  string `json:"leaderName"`
	LeaderPhone string `json:"leaderPhone"`
	MemberCount int    `json:"memberCount"`
	JoinedAt    string `json:"joinedAt"`
}

// GET /me/groups
func (h Handler) Mine(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT g.id, g.name, g.type, m.role, COALESCE(g.schedule,''), COALESCE(g.location,''),
		       COALESCE(l.name,''), COALESCE(l.phone,''),
		       (SELECT COUNT(*) FROM group_members x JOIN users u ON u.id=x.user_id WHERE x.group_id=g.id AND u.deleted_at IS NULL),
		       to_char(m.joined_at AT TIME ZONE 'UTC','YYYY-MM-DD')
		FROM group_members m
		JOIN ministry_groups g ON g.id=m.group_id AND g.deleted_at IS NULL
		LEFT JOIN users l ON l.id=g.leader_id
		WHERE m.user_id::text=$1
		ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END, g.name`, userID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "groups_failed", "Could not load your groups")
		return
	}
	defer rows.Close()
	out := []Group{}
	for rows.Next() {
		var g Group
		if rows.Scan(&g.ID, &g.Name, &g.Type, &g.Role, &g.Schedule, &g.Location, &g.LeaderName, &g.LeaderPhone, &g.MemberCount, &g.JoinedAt) == nil {
			out = append(out, g)
		}
	}
	httpx.OK(c, gin.H{"groups": out})
}

type Person struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Phone  string `json:"phone"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

// GET /me/groups/:id/members — only for the group's leader or assistants.
func (h Handler) Members(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	ctx := c.Request.Context()
	var leads bool
	_ = h.db.QueryRow(ctx, `SELECT EXISTS(
		SELECT 1 FROM group_members m JOIN ministry_groups g ON g.id=m.group_id AND g.deleted_at IS NULL
		WHERE m.group_id=$1 AND m.user_id::text=$2 AND m.role IN ('leader','assistant'))
		OR EXISTS(SELECT 1 FROM ministry_groups WHERE id=$1 AND deleted_at IS NULL AND leader_id::text=$2)`, c.Param("id"), userID).Scan(&leads)
	if !leads {
		httpx.Error(c, http.StatusForbidden, "forbidden", "Only the group's leaders can see its members")
		return
	}
	rows, err := h.db.Query(ctx, `SELECT u.id::text, u.name, COALESCE(u.phone,''), u.email, m.role FROM group_members m JOIN users u ON u.id=m.user_id
		WHERE m.group_id=$1 AND u.deleted_at IS NULL ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END, u.name`, c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "groups_failed", "Could not load the members")
		return
	}
	defer rows.Close()
	out := []Person{}
	for rows.Next() {
		var p Person
		if rows.Scan(&p.UserID, &p.Name, &p.Phone, &p.Email, &p.Role) == nil {
			out = append(out, p)
		}
	}
	httpx.OK(c, gin.H{"members": out})
}
