// Package permissions answers "may this member do X?". Admins may do
// everything; other members only what an admin has granted them.
package permissions

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/auth"
)

const (
	LiveBroadcast = "live:broadcast"
	LiveModerate  = "live:moderate"
	BooksPublish  = "books:publish"
	CheckinScan   = "checkin:scan"
)

var All = []string{LiveBroadcast, LiveModerate, BooksPublish, CheckinScan}

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

// IsAdmin reports whether the account has the admin (or super admin) role.
func (c Checker) IsAdmin(ctx context.Context, userID string) bool {
	var role string
	err := c.db.QueryRow(ctx, `SELECT role FROM users WHERE id = $1 AND is_active = TRUE`, userID).Scan(&role)
	return err == nil && (role == "admin" || role == "super_admin")
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
	rctx := ctx.Request.Context()
	adminID, _ := auth.UserIDFromContext(ctx)
	tx, err := c.db.Begin(rctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update permissions"})
		return
	}
	defer tx.Rollback(rctx)
	var before []string
	if err := tx.QueryRow(rctx, `SELECT permissions FROM users WHERE id = $1 FOR UPDATE`, ctx.Param("id")).Scan(&before); err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"message": "Member not found"})
		return
	}
	if _, err := tx.Exec(rctx, `UPDATE users SET permissions = $2, updated_at = NOW() WHERE id = $1`, ctx.Param("id"), clean); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update permissions"})
		return
	}
	// Record each change for the permission log.
	for _, p := range All {
		had, has := slices.Contains(before, p), slices.Contains(clean, p)
		if had == has {
			continue
		}
		action := "granted"
		if had {
			action = "removed"
		}
		if _, err := tx.Exec(rctx, `INSERT INTO permission_changes (user_id, permission, action, changed_by) VALUES ($1, $2, $3, NULLIF($4, '')::uuid)`,
			ctx.Param("id"), p, action, adminID); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update permissions"})
			return
		}
	}
	if err := tx.Commit(rctx); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update permissions"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"permissions": clean})
}

type changeRow struct {
	Member     string    `json:"member"`
	Email      string    `json:"email"`
	Permission string    `json:"permission"`
	Action     string    `json:"action"`
	ChangedBy  string    `json:"changedBy"`
	At         time.Time `json:"at"`
}

// AdminPermissionLog: GET /admin/permissions/log — the latest grants and removals.
func (c Checker) AdminPermissionLog(ctx *gin.Context) {
	rows, err := c.db.Query(ctx.Request.Context(), `
		SELECT u.name, u.email, pc.permission, pc.action, COALESCE(a.name, 'System'), pc.created_at
		FROM permission_changes pc JOIN users u ON u.id = pc.user_id LEFT JOIN users a ON a.id = pc.changed_by
		ORDER BY pc.created_at DESC LIMIT 200`)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load the log"})
		return
	}
	defer rows.Close()
	items := make([]changeRow, 0)
	for rows.Next() {
		var r changeRow
		if err := rows.Scan(&r.Member, &r.Email, &r.Permission, &r.Action, &r.ChangedBy, &r.At); err == nil {
			items = append(items, r)
		}
	}
	ctx.JSON(http.StatusOK, gin.H{"changes": items})
}
