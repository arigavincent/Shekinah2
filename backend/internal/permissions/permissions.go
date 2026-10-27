// Package permissions answers "may this member do X?". Admins may do
// everything; other members only what an admin has granted them.
package permissions

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/auth"
)

const (
	LiveBroadcast = "live:broadcast"
	LiveModerate  = "live:moderate"
	BooksPublish  = "books:publish"
)

var All = []string{LiveBroadcast, LiveModerate, BooksPublish}

type Checker struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) Checker { return Checker{db: db} }

// Of returns the member's effective permissions.
func (c Checker) Of(ctx context.Context, userID string) ([]string, error) {
	var role string
	var granted []string
	err := c.db.QueryRow(ctx, `SELECT role, permissions FROM users WHERE id = $1 AND is_active = TRUE`, userID).Scan(&role, &granted)
	if err != nil {
		return nil, err
	}
	if role == "admin" || role == "super_admin" {
		return All, nil
	}
	out := make([]string, 0, len(granted))
	for _, p := range granted {
		if slices.Contains(All, p) {
			out = append(out, p)
		}
	}
	return out, nil
}

func (c Checker) Has(ctx context.Context, userID, permission string) bool {
	list, err := c.Of(ctx, userID)
	return err == nil && slices.Contains(list, permission)
}

// Require is middleware: signed in (via auth.RequireAuth before it) and allowed.
func (c Checker) Require(permission string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userID, ok := auth.UserIDFromContext(ctx)
		if !ok || !c.Has(ctx.Request.Context(), userID, permission) {
			ctx.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to do that"})
			ctx.Abort()
			return
		}
		ctx.Next()
	}
}

// Mine: GET /permissions/me
func (c Checker) Mine(ctx *gin.Context) {
	userID, _ := auth.UserIDFromContext(ctx)
	list, err := c.Of(ctx.Request.Context(), userID)
	if err != nil {
		list = []string{}
	}
	ctx.JSON(http.StatusOK, gin.H{"permissions": list})
}

type memberRow struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
}

// AdminListMembers: GET /admin/members?query=
func (c Checker) AdminListMembers(ctx *gin.Context) {
	q := "%" + strings.ToLower(strings.TrimSpace(ctx.Query("query"))) + "%"
	rows, err := c.db.Query(ctx.Request.Context(), `
		SELECT id::text, name, email, role, permissions FROM users
		WHERE is_active = TRUE AND (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1)
		ORDER BY (array_length(permissions, 1) IS NULL), role <> 'member' DESC, name LIMIT 100
	`, q)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load members"})
		return
	}
	defer rows.Close()
	items := make([]memberRow, 0)
	for rows.Next() {
		var m memberRow
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.Permissions); err == nil {
			items = append(items, m)
		}
	}
	ctx.JSON(http.StatusOK, gin.H{"members": items, "available": All})
}

// AdminSetPermissions: PATCH /admin/members/:id/permissions {"permissions": [...]}
func (c Checker) AdminSetPermissions(ctx *gin.Context) {
	var req struct {
		Permissions []string `json:"permissions"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid permissions"})
		return
	}
	clean := make([]string, 0, len(req.Permissions))
	for _, p := range req.Permissions {
		if slices.Contains(All, p) && !slices.Contains(clean, p) {
			clean = append(clean, p)
		}
	}
	tag, err := c.db.Exec(ctx.Request.Context(), `UPDATE users SET permissions = $2, updated_at = NOW() WHERE id = $1`, ctx.Param("id"), clean)
	if err != nil || tag.RowsAffected() == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"message": "Member not found"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"permissions": clean})
}
