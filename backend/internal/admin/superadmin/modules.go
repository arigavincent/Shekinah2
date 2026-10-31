package superadmin

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// moduleFor names the switchable feature behind a request, or "" for none.
// Staff tools stay reachable so a feature can always be switched back on.
func moduleFor(method, path string) string {
	p := strings.TrimPrefix(path, "/api/v1/")
	switch {
	case strings.HasPrefix(p, "admin/sa/members/") && strings.Contains(p, "/pastoral-notes"):
		return "counseling"
	case strings.HasPrefix(p, "admin/sa/members/") && strings.HasSuffix(p, "/donation-statement"):
		return "taxStatements"
	case strings.HasPrefix(p, "admin/"):
		return ""
	case strings.HasPrefix(p, "giving/") && method != http.MethodGet && !strings.Contains(p, "callback"):
		return "onlineGiving"
	case strings.HasPrefix(p, "live/"):
		return "livestream"
	case strings.HasPrefix(p, "community/"), strings.HasPrefix(p, "private-chat/"):
		return "communityChat"
	case strings.HasPrefix(p, "serve/"):
		return "volunteerScheduling"
	case strings.HasPrefix(p, "checkin/"), strings.HasPrefix(p, "attendance/"):
		return "attendanceKiosk"
	}
	return ""
}

var moduleNames = map[string]string{
	"onlineGiving": "Online giving", "livestream": "Live streaming", "communityChat": "Chat",
	"volunteerScheduling": "Serve requests", "attendanceKiosk": "Check-in", "counseling": "Pastoral notes", "taxStatements": "Giving statements",
}

type moduleCache struct {
	sync.Mutex
	at    time.Time
	state map[string]bool
}

func (m *moduleCache) get(ctx context.Context, db *pgxpool.Pool) map[string]bool {
	m.Lock()
	defer m.Unlock()
	if m.state == nil || time.Since(m.at) > 10*time.Second {
		m.state, m.at = LoadModules(ctx, db), time.Now()
	}
	return m.state
}

var moduleState moduleCache

// ModuleGate refuses requests for features a super admin switched off.
func ModuleGate(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		name := moduleFor(c.Request.Method, c.FullPath())
		if name != "" && !moduleState.get(c.Request.Context(), db)[name] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": moduleNames[name] + " is switched off by the church for now.", "module": name})
			return
		}
		c.Next()
	}
}

// PublicModules lets the apps hide features that are switched off.
func PublicModules(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "public, max-age=30")
		c.JSON(http.StatusOK, gin.H{"modules": moduleState.get(c.Request.Context(), db)})
	}
}
