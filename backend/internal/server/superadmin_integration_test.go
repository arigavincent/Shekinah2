package server_test

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
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

func TestSuperAdminToolsAccessSafetyAndEffects(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "super-admin-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	withKey := func(method, path, key string) int {
		r := httptest.NewRequest(method, "/api/v1"+path, nil)
		r.Header.Set("X-API-Key", key)
		w := httptest.NewRecorder()
		app.ServeHTTP(w, r)
		return w.Code
	}
	outbox := func(event string) int {
		var n int
		_ = db.QueryRow(ctx, `SELECT COUNT(*) FROM webhook_outbox WHERE event=$1`, event).Scan(&n)
		return n
	}

	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "SuperAdmin123!"}, login["token"].(string), 200)["token"].(string)
	var adminID string
	_ = db.QueryRow(ctx, `SELECT id::text FROM users WHERE email='vincent@example.com'`).Scan(&adminID)

	// An ordinary admin cannot open Super Admin tools.
	req("GET", "/admin/sa/groups", nil, admin, 403)
	if _, err = db.Exec(ctx, `UPDATE users SET role='super_admin' WHERE id=$1`, adminID); err != nil {
		t.Fatal(err)
	}
	req("GET", "/admin/sa/groups", nil, admin, 200)

	// Accounts: no shared default password; suspension signs the person out.
	created := req("POST", "/admin/sa/users", map[string]any{"name": "New Usher", "email": "usher@example.invalid", "permissions": []string{"checkin:scan", "bogus"}}, admin, 201)
	temp, _ := created["temporaryPassword"].(string)
	if len(temp) < 12 || temp == "Shekinah2026!" {
		t.Fatalf("expected a random temporary password, got %q", temp)
	}
	usherID := created["id"].(string)
	usher := req("POST", "/auth/login", map[string]string{"email": "usher@example.invalid", "password": temp}, "", 200)["token"].(string)
	req("POST", "/admin/sa/users/"+usherID+"/suspend", nil, admin, 200)
	req("GET", "/auth/me", nil, usher, 401)
	req("POST", "/auth/login", map[string]string{"email": "usher@example.invalid", "password": temp}, "", 403)
	req("POST", "/admin/sa/users/"+usherID+"/suspend", nil, admin, 200)
	if outbox("member.created") == 0 {
		t.Fatal("new account was not queued for webhooks")
	}

	// A super admin cannot lock themselves out.
	req("POST", "/admin/sa/users/"+adminID+"/suspend", nil, admin, 400)
	req("DELETE", "/admin/sa/users/"+adminID, nil, admin, 400)
	req("PATCH", "/admin/sa/users/"+adminID, map[string]string{"role": "admin"}, admin, 400)

	// Security policy applies to member sign-up.
	req("PUT", "/admin/sa/system/security", map[string]any{"policies": map[string]int{"minPasswordLength": 14}}, admin, 200)
	req("POST", "/auth/register", map[string]string{"name": "Short", "email": "short@example.invalid", "password": "Thirteen13!!!"}, "", 400)
	req("PUT", "/admin/sa/system/security", map[string]any{"policies": map[string]int{"minPasswordLength": 8}}, admin, 200)

	// Feature switches are enforced for members and reported publicly.
	reg := req("POST", "/auth/register", map[string]string{"name": "Member", "email": "member.sa@example.invalid", "password": "MemberPass123!"}, "", 201)
	member, memberID := reg["token"].(string), reg["user"].(map[string]any)["id"].(string)
	req("GET", "/community/messages", nil, member, 200)
	req("PUT", "/admin/sa/system/modules", map[string]any{"modules": map[string]bool{"communityChat": false}}, admin, 200)
	req("GET", "/community/messages", nil, member, 403)
	if mods := req("GET", "/modules", nil, "", 200)["modules"].(map[string]any); mods["communityChat"] != false || mods["livestream"] != true {
		t.Fatalf("unexpected modules %v", mods)
	}
	req("PUT", "/admin/sa/system/modules", map[string]any{"modules": map[string]bool{"communityChat": true}}, admin, 200)

	// Finance: manual entry, statement, refund, all reaching the webhook outbox.
	req("PUT", "/admin/sa/finance/funds", map[string]string{"name": "Youth Camp", "code": "5010", "description": "Camp"}, admin, 200)
	tx := req("POST", "/admin/sa/finance/transactions", map[string]any{"fundId": "youth-camp", "amount": 1500, "currency": "KES", "type": "cash", "donorId": memberID, "notes": "Envelope"}, admin, 201)
	statement := req("GET", "/admin/sa/members/"+memberID+"/donation-statement?year="+time.Now().Format("2006"), nil, admin, 200)
	if statement["totals"].(map[string]any)["KES"] != float64(1500) {
		t.Fatalf("statement totals %v", statement["totals"])
	}
	req("POST", "/admin/sa/finance/transactions/"+tx["id"].(string)+"/refund", map[string]string{"reason": "Duplicate envelope"}, admin, 200)
	req("POST", "/admin/sa/finance/transactions/"+tx["id"].(string)+"/refund", map[string]string{"reason": "Again"}, admin, 404)
	if outbox("giving.received") == 0 || outbox("giving.refunded") == 0 {
		t.Fatal("payment events were not queued for webhooks")
	}

	// Groups and attendance.
	group := req("PUT", "/admin/sa/groups", map[string]any{"name": "Ushers", "type": "ministry", "leaderId": memberID, "maxCapacity": 1}, admin, 200)
	req("POST", "/admin/sa/groups/"+group["id"].(string)+"/roster", map[string]string{"userId": usherID}, admin, 409)
	if roster := req("GET", "/admin/sa/groups/"+group["id"].(string)+"/roster", nil, admin, 200)["members"].([]any); len(roster) != 1 {
		t.Fatalf("leader should be on the roster: %v", roster)
	}
	req("POST", "/admin/sa/attendance/sessions", map[string]any{"title": "Sunday", "occasion": "Service", "sessionDate": "2026-11-01", "headcount": 230}, admin, 201)

	// Pastoral notes.
	req("POST", "/admin/sa/members/"+memberID+"/pastoral-notes", map[string]string{"note": "Visited family"}, admin, 201)
	if notes := req("GET", "/admin/sa/members/"+memberID+"/pastoral-notes", nil, admin, 200)["notes"].([]any); len(notes) != 1 || notes[0].(map[string]any)["note"] != "Visited family" {
		t.Fatalf("notes %v", notes)
	}

	// API keys reach only the staff tools their permissions allow.
	key := req("POST", "/admin/sa/api-keys", map[string]any{"name": "Zapier", "permissions": []string{"sermons:manage"}}, admin, 201)["key"].(string)
	if code := withKey("GET", "/admin/sermons", key); code != 200 {
		t.Fatalf("scoped key should list sermons, got %d", code)
	}
	for _, path := range []string{"/admin/events", "/admin/sa/groups", "/admin/settings/integrations", "/auth/me"} {
		if code := withKey("GET", path, key); code != 403 && code != 401 {
			t.Fatalf("key reached %s (%d)", path, code)
		}
	}
	keys := req("GET", "/admin/sa/api-keys", nil, admin, 200)["keys"].([]any)
	req("DELETE", "/admin/sa/api-keys/"+keys[0].(map[string]any)["id"].(string), nil, admin, 200)
	if code := withKey("GET", "/admin/sermons", key); code != 401 {
		t.Fatalf("revoked key still works (%d)", code)
	}

	// Webhooks accept only https and never reach private addresses.
	req("PUT", "/admin/sa/webhooks", map[string]any{"url": "http://example.com/hook", "events": []string{"giving.received"}}, admin, 400)
	hook := req("PUT", "/admin/sa/webhooks", map[string]any{"url": "https://127.0.0.1/hook", "events": []string{"giving.received"}}, admin, 200)
	if test := req("POST", "/admin/sa/webhooks/"+hook["id"].(string)+"/test", nil, admin, 200); test["status"] != float64(0) {
		t.Fatalf("private address was contacted: %v", test)
	}

	// Backup is a real archive of every table.
	r := httptest.NewRequest("POST", "/api/v1/admin/sa/system/backup", nil)
	r.Header.Set("Authorization", "Bearer "+admin)
	w := httptest.NewRecorder()
	app.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("backup %d", w.Code)
	}
	gz, err := gzip.NewReader(w.Body)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for tr := tar.NewReader(gz); ; {
		h, err := tr.Next()
		if err == io.EOF {
			break
		} else if err != nil {
			t.Fatal(err)
		}
		if h.Name == "users.csv" {
			data, _ := io.ReadAll(tr)
			found = strings.Contains(string(data), "usher@example.invalid")
		}
	}
	if !found {
		t.Fatal("backup is missing users")
	}

	// Merging moves history; erasing keeps payments without personal details.
	dup := req("POST", "/auth/register", map[string]string{"name": "Member Again", "email": "member.dup@example.invalid", "password": "MemberPass123!"}, "", 201)["user"].(map[string]any)["id"].(string)
	if _, err = db.Exec(ctx, `INSERT INTO giving_transactions(id,user_id,amount,method,status,category,phone)VALUES('dup-gift',$1,300,'manual','success','Tithe','')`, dup); err != nil {
		t.Fatal(err)
	}
	req("POST", "/admin/sa/members/"+dup+"/merge", map[string]string{"mergeIntoId": memberID}, admin, 200)
	var owner string
	_ = db.QueryRow(ctx, `SELECT user_id::text FROM giving_transactions WHERE id='dup-gift'`).Scan(&owner)
	if owner != memberID {
		t.Fatal("merge did not move giving history")
	}
	req("DELETE", "/admin/sa/members/"+memberID+"/purge-gdpr", map[string]string{}, admin, 400)
	req("DELETE", "/admin/sa/members/"+memberID+"/purge-gdpr", map[string]string{"reason": "Member request"}, admin, 200)
	var left, kept int
	_ = db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE id::text=$1`, memberID).Scan(&left)
	_ = db.QueryRow(ctx, `SELECT COUNT(*) FROM giving_transactions WHERE id='dup-gift' AND user_id IS NULL`).Scan(&kept)
	if left != 0 || kept != 1 {
		t.Fatalf("erase left=%d kept=%d", left, kept)
	}

	// Everything above is in the audit trail.
	entries := req("GET", "/admin/sa/audit-trail?limit=200", nil, admin, 200)["entries"].([]any)
	seen := map[string]bool{}
	for _, e := range entries {
		seen[e.(map[string]any)["method"].(string)] = true
	}
	for _, action := range []string{"CREATE_USER", "SUSPEND_USER", "MANUAL_PAYMENT", "REFUND", "API_KEY_CREATED", "BACKUP", "MERGE_MEMBERS", "ERASE_PERSONAL_DATA"} {
		if !seen[action] {
			t.Fatalf("audit trail is missing %s", action)
		}
	}
}
