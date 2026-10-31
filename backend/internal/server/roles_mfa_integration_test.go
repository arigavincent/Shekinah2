package server_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func totpCode(secret string, step int64) string {
	key, _ := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	var counter [8]byte
	binary.BigEndian.PutUint64(counter[:], uint64(step))
	mac := hmac.New(sha1.New, key)
	mac.Write(counter[:])
	sum := mac.Sum(nil)
	o := sum[len(sum)-1] & 0x0f
	return fmt.Sprintf("%06d", (binary.BigEndian.Uint32(sum[o:o+4])&0x7fffffff)%1_000_000)
}

func TestRoleDesignerTwoStepSignInAndIdleSignOut(t *testing.T) {
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("set TEST_DATABASE_URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "roles-mfa-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "RolesAdmin123!"}, login["token"].(string), 200)["token"].(string)
	if _, err = db.Exec(ctx, `UPDATE users SET role='super_admin' WHERE email='vincent@example.com'`); err != nil {
		t.Fatal(err)
	}
	reg := req("POST", "/auth/register", map[string]string{"name": "Media Lead", "email": "media.lead@example.invalid", "password": "MediaLead123!"}, "", 201)
	staff, staffID := reg["token"].(string), reg["user"].(map[string]any)["id"].(string)

	// Roles: a role's permissions reach its holders and follow its edits.
	req("GET", "/admin/events", nil, staff, 403)
	role := req("PUT", "/admin/sa/roles", map[string]any{"name": "Events team", "permissions": []string{"events:manage"}}, admin, 200)["id"].(string)
	req("PUT", "/admin/sa/roles", map[string]any{"name": "Events team", "permissions": []string{"bogus"}}, admin, 400)
	req("PUT", "/admin/sa/users/"+staffID+"/role", map[string]string{"roleId": role}, admin, 200)
	req("GET", "/admin/events", nil, staff, 200)
	req("GET", "/admin/sermons", nil, staff, 403)
	req("PUT", "/admin/sa/roles", map[string]any{"id": role, "name": "Events team", "permissions": []string{"events:manage", "sermons:manage"}}, admin, 200)
	req("GET", "/admin/sermons", nil, staff, 200)
	copy := req("POST", "/admin/sa/roles/"+role+"/duplicate", nil, admin, 201)
	if copy["name"] == "Events team" {
		t.Fatal("duplicate must get a distinct name")
	}
	roles := req("GET", "/admin/sa/roles", nil, admin, 200)["roles"].([]any)
	if len(roles) != 2 {
		t.Fatalf("roles %v", roles)
	}
	req("DELETE", "/admin/sa/roles/"+role, nil, admin, 200)
	req("GET", "/admin/events", nil, staff, 403)
	req("PUT", "/admin/sa/users/"+staffID+"/role", map[string]string{"roleId": copy["id"].(string)}, admin, 200)

	// Two-step sign-in: set up, codes work once, the ticket is not a session.
	req("PUT", "/admin/sa/system/security", map[string]any{"policies": map[string]any{"minPasswordLength": 8, "mfaRequiredForStaff": true}}, admin, 400)
	secret := req("POST", "/auth/mfa/setup", nil, admin, 200)["secret"].(string)
	step := time.Now().Unix() / 30
	req("POST", "/auth/mfa/enable", map[string]string{"code": "000000"}, admin, 400)
	req("POST", "/auth/mfa/enable", map[string]string{"code": totpCode(secret, step)}, admin, 200)
	first := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "RolesAdmin123!"}, "", 200)
	if first["mfaRequired"] != true || first["token"] != "" {
		t.Fatalf("password alone must not sign in: %v", first)
	}
	ticket := first["mfaToken"].(string)
	req("GET", "/auth/me", nil, ticket, 401)
	req("POST", "/auth/mfa/verify", map[string]string{"mfaToken": ticket, "code": totpCode(secret, step)}, "", 401)
	admin = req("POST", "/auth/mfa/verify", map[string]string{"mfaToken": ticket, "code": totpCode(secret, step+1)}, "", 200)["token"].(string)
	req("GET", "/admin/sa/groups", nil, admin, 200)

	// Required for staff: the role holder must set it up first.
	req("PUT", "/admin/sa/system/security", map[string]any{"policies": map[string]any{"minPasswordLength": 8, "mfaRequiredForStaff": true, "idleMinutes": 15}}, admin, 200)
	if out := req("GET", "/admin/events", nil, staff, 403); out["code"] != "mfa_setup_required" {
		t.Fatalf("expected setup prompt, got %v", out)
	}
	if st := req("GET", "/auth/mfa", nil, staff, 200); st["required"] != true || st["enabled"] != false {
		t.Fatalf("status %v", st)
	}
	staffSecret := req("POST", "/auth/mfa/setup", nil, staff, 200)["secret"].(string)
	req("POST", "/auth/mfa/enable", map[string]string{"code": totpCode(staffSecret, time.Now().Unix()/30)}, staff, 200)
	req("GET", "/admin/events", nil, staff, 200)
	req("POST", "/auth/mfa/disable", map[string]string{"code": totpCode(staffSecret, time.Now().Unix()/30+1)}, staff, 403)

	// Idle sign-out after the configured minutes.
	if _, err = db.Exec(ctx, `UPDATE users SET staff_active_at=NOW()-INTERVAL '20 minutes' WHERE id::text=$1`, staffID); err != nil {
		t.Fatal(err)
	}
	if out := req("GET", "/admin/events", nil, staff, 401); out["code"] != "idle_timeout" {
		t.Fatalf("expected idle sign-out, got %v", out)
	}
	req("GET", "/auth/me", nil, staff, 200) // member areas are not affected
}
