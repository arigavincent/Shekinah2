package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Every Super Admin endpoint refuses a normal admin, staff and members, for
// every method, and admits the super admin.
func TestSuperAdminToolsRefuseNormalAdmins(t *testing.T) {
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("set TEST_DATABASE_URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	db, err := pgxpool.New(ctx, createTempDatabase(t, ctx, base))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = database.RunMigrations(ctx, db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	t.Setenv("NOTIFICATIONS_DELIVERY_ENABLED", "false")
	gin.SetMode(gin.TestMode)
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "sa-boundary-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	super := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "SuperBoundary123!"}, login["token"].(string), 200)["token"].(string)
	if _, err = db.Exec(ctx, `UPDATE users SET role='super_admin' WHERE email='vincent@example.com'`); err != nil {
		t.Fatal(err)
	}
	mk := func(email, role string, perms []string) string {
		tok := req("POST", "/auth/register", map[string]string{"name": role, "email": email, "phone": "0712345678", "password": "Boundary12345!"}, "", 201)["token"].(string)
		if _, err := db.Exec(ctx, `UPDATE users SET role=$2, permissions=$3 WHERE email=$1`, email, role, perms); err != nil {
			t.Fatal(err)
		}
		return tok
	}
	admin := mk("plain.admin@example.invalid", "admin", []string{})
	staff := mk("all.perms@example.invalid", "member", []string{"sermons:manage", "events:manage", "content:manage", "finance:manage", "checkin:scan", "books:publish", "community:moderate", "live:broadcast", "live:moderate"})
	member := mk("member.boundary@example.invalid", "member", []string{})

	checked := 0
	for _, r := range app.Routes() {
		if !strings.HasPrefix(r.Path, "/api/v1/admin/sa/") && r.Path != "/api/v1/admin/sa" {
			continue
		}
		path := strings.TrimPrefix(r.Path, "/api/v1")
		for _, seg := range []string{":id", ":noteId", ":key", ":roleId"} {
			path = strings.ReplaceAll(path, seg, "probe")
		}
		for name, tok := range map[string]string{"admin": admin, "staff with every permission": staff, "member": member} {
			code := assertAnyStatus(t, app, r.Method, "/api/v1"+path, map[string]any{}, tok)
			if code != 403 {
				t.Errorf("%s %s as %s: got %d, want 403", r.Method, path, name, code)
			}
		}
		if r.Method == "GET" && !strings.Contains(path, "probe") {
			if code := assertAnyStatus(t, app, r.Method, "/api/v1"+path, nil, super); code >= 400 && code != 404 {
				t.Errorf("GET %s as super admin: %d", path, code)
			}
		}
		checked++
	}
	if checked < 30 {
		t.Fatalf("only %d super admin routes found", checked)
	}
	t.Logf("checked %d super admin routes", checked)
}

func assertAnyStatus(t *testing.T, app http.Handler, method, path string, payload any, token string) int {
	t.Helper()
	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	app.ServeHTTP(rec, req)
	return rec.Code
}
