package permissions

import (
	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

// Administrative routes keep their URLs, but staff receive only the capabilities
// granted to them. Account management and system settings remain admin-only.
func (c Checker) StaffRoute() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, _ := auth.UserIDFromContext(ctx)
		var reset bool
		if err := c.db.QueryRow(ctx.Request.Context(), `SELECT password_reset_required FROM users WHERE id=$1`, user).Scan(&reset); err != nil || reset {
			ctx.AbortWithStatusJSON(403, gin.H{"message": "Reset your password before using staff tools"})
			return
		}
		if c.IsAdmin(ctx.Request.Context(), user) {
			ctx.Next()
			return
		}
		path := strings.TrimPrefix(ctx.FullPath(), "/api/v1/admin/")
		permission := ""
		switch {
		case strings.HasPrefix(path, "sermons"), strings.HasPrefix(path, "sermon-categories"):
			permission = SermonsManage
		case strings.HasPrefix(path, "events"):
			permission = EventsManage
		case strings.HasPrefix(path, "devotions"), strings.HasPrefix(path, "updates"), strings.HasPrefix(path, "reading-plans"):
			permission = ContentManage
		case strings.HasPrefix(path, "community"), strings.HasPrefix(path, "testimonies"):
			permission = CommunityModerate
		case strings.HasPrefix(path, "checkins"):
			permission = CheckinScan
		case path == "giving/details" && ctx.Request.Method != "GET":
			permission = ""
		case strings.HasPrefix(path, "giving"):
			permission = FinanceManage
		case path == "media":
			if c.Has(ctx.Request.Context(), user, EventsManage) || c.Has(ctx.Request.Context(), user, SermonsManage) || c.Has(ctx.Request.Context(), user, ContentManage) || c.Has(ctx.Request.Context(), user, BooksPublish) {
				ctx.Next()
				return
			}
		}
		if permission == "" || !c.Has(ctx.Request.Context(), user, permission) {
			ctx.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "This tool requires an assigned staff permission"})
			return
		}
		ctx.Next()
	}
}

// Record the actor and affected route, never request bodies, credentials or files.
func (c Checker) Audit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Next()
		if ctx.Request.Method == "GET" || ctx.Request.Method == "HEAD" || ctx.Writer.Status() >= 400 {
			return
		}
		user, _ := auth.UserIDFromContext(ctx)
		id := ctx.Param("id")
		if id == "" {
			id = ctx.GetString("audit_item_id")
		}
		_, _ = c.db.Exec(ctx.Request.Context(), `INSERT INTO staff_actions(actor_id,method,route,item_id) VALUES(NULLIF($1,'')::uuid,$2,$3,$4)`, user, ctx.Request.Method, ctx.FullPath(), id)
	}
}
