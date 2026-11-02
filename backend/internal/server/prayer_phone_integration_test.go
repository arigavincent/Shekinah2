package server_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/prayers"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPhoneRequiredAndPrayerWallExpiry(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "prayer-phone-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}

	// Phone number is required and stored in one form.
	req("POST", "/auth/register", map[string]string{"name": "No Phone", "email": "nophone@example.invalid", "password": "MemberPass123!"}, "", 400)
	req("POST", "/auth/register", map[string]string{"name": "Bad Phone", "email": "badphone@example.invalid", "phone": "12345", "password": "MemberPass123!"}, "", 400)
	reg := req("POST", "/auth/register", map[string]string{"name": "Grace Member", "email": "grace@example.invalid", "phone": "0712 345 678", "password": "MemberPass123!"}, "", 201)
	member := reg["token"].(string)
	if p := reg["user"].(map[string]any)["phone"]; p != "+254712345678" {
		t.Fatalf("phone %v", p)
	}
	// Members who joined before can add it.
	if _, err = db.Exec(ctx, `UPDATE users SET phone='' WHERE email='grace@example.invalid'`); err != nil {
		t.Fatal(err)
	}
	if p := req("GET", "/auth/me", nil, member, 200)["user"].(map[string]any)["phone"]; p != "" {
		t.Fatalf("expected empty phone, got %v", p)
	}
	req("PATCH", "/auth/phone", map[string]string{"phone": "abc"}, member, 400)
	if p := req("PATCH", "/auth/phone", map[string]string{"phone": "254 110 123 456"}, member, 200)["user"].(map[string]any)["phone"]; p != "+254110123456" {
		t.Fatalf("updated phone %v", p)
	}

	// Prayer wall: a request leaves after the set days, can be kept up, answered or pinned.
	id := req("POST", "/prayer-requests", map[string]any{"category": "Healing", "text": "Please pray for my mother's recovery.", "isPublic": true}, member, 201)["prayer"].(map[string]any)["id"].(string)
	wall := func() int { return len(req("GET", "/prayer-requests", nil, "", 200)["prayers"].([]any)) }
	mine := func() map[string]any {
		return req("GET", "/prayer-requests/mine", nil, member, 200)["prayers"].([]any)[0].(map[string]any)
	}
	before := wall()
	if m := mine(); m["onWall"] != true || m["leavesOn"] == "" {
		t.Fatalf("new request %v", m)
	}
	if _, err = db.Exec(ctx, `UPDATE prayers SET shown_from = now() - interval '31 days' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if wall() != before-1 || mine()["onWall"] != false {
		t.Fatalf("expired request still on the wall")
	}
	req("POST", "/prayer-requests/"+id+"/keep", nil, member, 200)
	if wall() != before || mine()["onWall"] != true {
		t.Fatalf("kept request not back on the wall")
	}
	req("POST", "/prayer-requests/"+id+"/answered", nil, member, 200)
	if mine()["status"] != "answered" {
		t.Fatalf("not answered: %v", mine())
	}
	// Someone else's request can't be changed.
	other := req("POST", "/auth/register", map[string]string{"name": "Other", "email": "other@example.invalid", "phone": "0722000000", "password": "MemberPass123!"}, "", 201)["token"].(string)
	req("POST", "/prayer-requests/"+id+"/keep", nil, other, 404)

	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "PrayerAdmin123!"}, login["token"].(string), 200)["token"].(string)
	if _, err = db.Exec(ctx, `UPDATE prayers SET shown_from = now() - interval '60 days' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	req("PATCH", "/admin/prayers/"+id+"/pin", map[string]bool{"pinned": true}, admin, 200)
	if wall() != before || mine()["onWall"] != true {
		t.Fatalf("pinned request not on the wall")
	}
	req("PATCH", "/admin/prayers/"+id+"/pin", map[string]bool{"pinned": true}, member, 403)
	if d := req("GET", "/admin/prayers/settings", nil, admin, 200)["wallDays"]; d != float64(30) {
		t.Fatalf("default days %v", d)
	}
	req("PUT", "/admin/prayers/settings", map[string]int{"wallDays": 0}, admin, 400)
	req("PUT", "/admin/prayers/settings", map[string]int{"wallDays": 14}, admin, 200)
	req("PATCH", "/admin/prayers/"+id+"/pin", map[string]bool{"pinned": false}, admin, 200)
	if _, err = db.Exec(ctx, `UPDATE prayers SET shown_from = now() - interval '15 days' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if wall() != before-1 {
		t.Fatalf("14-day setting not applied")
	}

	// Reminder two days before leaving, sent once; requests a year past the wall are deleted.
	if _, err = db.Exec(ctx, `UPDATE prayers SET shown_from = now() - interval '12 days 1 hour', status='reviewed', reminded_at=NULL WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	var reminded []string
	h := prayers.NewHandler(db).WithReminder(func(_ context.Context, userID, title, _ string, data map[string]interface{}) {
		reminded = append(reminded, userID+"|"+title+"|"+data["id"].(string))
	})
	h.ExpiryPass(ctx)
	h.ExpiryPass(ctx)
	if len(reminded) != 1 {
		t.Fatalf("reminders %v", reminded)
	}
	if _, err = db.Exec(ctx, `UPDATE prayers SET shown_from = now() - interval '400 days' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	h.ExpiryPass(ctx)
	var left int
	_ = db.QueryRow(ctx, `SELECT COUNT(*) FROM prayers WHERE id=$1`, id).Scan(&left)
	if left != 0 {
		t.Fatalf("old request not deleted")
	}
}

func TestMembersDeleteTheirOwnAccount(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "self-delete-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	tok := req("POST", "/auth/register", map[string]string{"name": "Leaving Member", "email": "leaving@example.invalid", "phone": "0712345678", "password": "LeavingPass123!"}, "", 201)["token"].(string)
	req("POST", "/prayer-requests", map[string]any{"category": "Healing", "text": "Please pray for my family.", "isPublic": true}, tok, 201)
	req("POST", "/playlists", map[string]any{"name": "Mine"}, tok, 201)
	req("POST", "/auth/delete-account", map[string]string{"password": "wrong"}, tok, 401)
	req("POST", "/auth/delete-account", map[string]string{}, tok, 400)
	req("POST", "/auth/delete-account", map[string]string{"password": "LeavingPass123!"}, "", 401)
	req("POST", "/auth/delete-account", map[string]string{"password": "LeavingPass123!"}, tok, 200)
	var users, prayers, lists int
	_ = db.QueryRow(ctx, `SELECT (SELECT COUNT(*) FROM users WHERE email='leaving@example.invalid'), (SELECT COUNT(*) FROM prayers WHERE text='Please pray for my family.'), (SELECT COUNT(*) FROM playlists WHERE name='Mine')`).Scan(&users, &prayers, &lists)
	if users+prayers+lists != 0 {
		t.Fatalf("left behind: users %d prayers %d playlists %d", users, prayers, lists)
	}
	req("POST", "/auth/login", map[string]string{"email": "leaving@example.invalid", "password": "LeavingPass123!"}, "", 401)
}
