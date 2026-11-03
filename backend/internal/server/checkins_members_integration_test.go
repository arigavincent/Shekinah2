package server_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The everyday staff journeys end to end: a member keeps their own details
// right, staff edit a member, and an usher checks people in at an event with
// the member's code (with the phone shown), seen in the recent list and in
// the member's own history.
func TestMemberDetailsAndEventCheckinsEndToEnd(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "checkins-members-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}

	// A super admin.
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "SuperAdmin123!"}, login["token"].(string), 200)["token"].(string)
	if _, err = db.Exec(ctx, `UPDATE users SET role='super_admin' WHERE email='vincent@example.com'`); err != nil {
		t.Fatal(err)
	}

	// --- A member keeps their own details right.
	reg := req("POST", "/auth/register", map[string]string{"name": "grace  w", "email": "grace.w@example.invalid", "phone": "0712 000 111", "password": "MemberPass123!"}, "", 201)
	member := reg["token"].(string)
	memberID := reg["user"].(map[string]any)["id"].(string)
	req("PATCH", "/auth/profile", map[string]any{}, member, 400)
	req("PATCH", "/auth/profile", map[string]string{"name": "G"}, member, 400)
	req("PATCH", "/auth/profile", map[string]string{"phone": "12"}, member, 400)
	me := req("PATCH", "/auth/profile", map[string]string{"name": "  Grace   Wanjiku ", "phone": "0722 333 444"}, member, 200)["user"].(map[string]any)
	if me["name"] != "Grace Wanjiku" || me["phone"] != "+254722333444" {
		t.Fatalf("profile not saved: %v", me)
	}
	if u := req("GET", "/auth/me", nil, member, 200)["user"].(map[string]any); u["name"] != "Grace Wanjiku" || u["phone"] != "+254722333444" {
		t.Fatalf("profile not kept: %v", u)
	}
	// Members cannot reach staff tools or other people's details.
	req("GET", "/admin/members", nil, member, 403)
	req("GET", "/admin/sa/users/"+memberID, nil, member, 403)
	req("POST", "/admin/checkins/verify", map[string]string{"code": "ABCDEFGHIJ", "eventId": "x"}, member, 403)

	// --- Staff see and edit a member.
	list := req("GET", "/admin/members", nil, admin, 200)["members"].([]any)
	found := false
	for _, m := range list {
		if row := m.(map[string]any); row["id"] == memberID {
			found = true
		}
	}
	if !found {
		t.Fatal("new member missing from the members list")
	}
	req("PATCH", "/admin/sa/users/"+memberID, map[string]any{"phone": "bad"}, admin, 400)
	req("PATCH", "/admin/sa/users/"+memberID, map[string]any{"name": "Grace W. Kamau", "membershipStatus": "member"}, admin, 200)
	profile := req("GET", "/admin/sa/users/"+memberID, nil, admin, 200)["profile"].(map[string]any)
	if profile["name"] != "Grace W. Kamau" || profile["phone"] != "+254722333444" || profile["membershipStatus"] != "member" {
		t.Fatalf("staff edit: %v", profile)
	}
	// A blank phone from staff keeps the member's number.
	req("PATCH", "/admin/sa/users/"+memberID, map[string]any{"phone": ""}, admin, 200)
	if p := req("GET", "/admin/sa/users/"+memberID, nil, admin, 200)["profile"].(map[string]any)["phone"]; p != "+254722333444" {
		t.Fatalf("blank phone wiped the number: %v", p)
	}

	// --- An usher with only the check-in permission.
	created := req("POST", "/admin/sa/users", map[string]any{"phone": "0733 111 222", "name": "Gate Usher", "email": "gate.usher@example.invalid", "permissions": []string{"checkin:scan"}}, admin, 201)
	temp := created["temporaryPassword"].(string)
	usher := req("POST", "/auth/login", map[string]string{"email": "gate.usher@example.invalid", "password": temp}, "", 200)["token"].(string)
	// Staff tools stay closed until the usher sets their own password.
	req("GET", "/admin/checkins/recent", nil, usher, 403)
	usher = req("PATCH", "/auth/password", map[string]string{"currentPassword": temp, "newPassword": "GateUsher123!"}, usher, 200)["token"].(string)
	req("GET", "/admin/sa/groups", nil, usher, 403)
	req("POST", "/admin/events", map[string]any{"title": "Nope"}, usher, 403)

	event := req("POST", "/admin/events", map[string]any{"title": "Youth Night", "eventDate": "2026-11-20", "eventTime": "18:00", "location": "Main hall", "description": "An evening of worship for the youth.", "isPublished": true}, admin, 201)["event"].(map[string]any)
	eventID := event["id"].(string)

	// The member shows their code; the usher checks them in.
	code := req("GET", "/checkin/code", nil, member, 200)["code"].(string)
	req("POST", "/admin/checkins/verify", map[string]string{"code": code, "eventId": "missing-event"}, usher, 404)
	req("POST", "/admin/checkins/verify", map[string]string{"code": "SHORT", "eventId": eventID}, usher, 400)
	req("POST", "/admin/checkins/verify", map[string]string{"code": "ZZZZZZZZZZ", "eventId": eventID}, usher, 404)
	first := req("POST", "/admin/checkins/verify", map[string]string{"code": code, "eventId": eventID, "notes": "Front row"}, usher, 200)
	if first["name"] != "Grace W. Kamau" || first["phone"] != "+254722333444" || first["eventTitle"] != "Youth Night" || first["alreadyCheckedIn"] != false {
		t.Fatalf("check-in: %v", first)
	}
	// Scanning again is safe and says so.
	if again := req("POST", "/admin/checkins/verify", map[string]string{"code": code, "eventId": eventID}, usher, 200); again["alreadyCheckedIn"] != true {
		t.Fatalf("second scan: %v", again)
	}
	var rows int
	_ = db.QueryRow(ctx, `SELECT COUNT(*) FROM event_checkins WHERE event_id=$1 AND user_id=$2`, eventID, memberID).Scan(&rows)
	if rows != 1 {
		t.Fatalf("expected one check-in row, got %d", rows)
	}

	// Staff see it in the recent list, with the phone.
	recent := req("GET", "/admin/checkins/recent", nil, usher, 200)["checkins"].([]any)
	if len(recent) == 0 {
		t.Fatal("recent check-ins empty")
	}
	if r := recent[0].(map[string]any); r["name"] != "Grace W. Kamau" || r["phone"] != "+254722333444" || r["eventTitle"] != "Youth Night" {
		t.Fatalf("recent: %v", r)
	}
	// The member sees it in their history.
	history := req("GET", "/checkin/history", nil, member, 200)["checkins"].([]any)
	if len(history) != 1 || history[0].(map[string]any)["eventTitle"] != "Youth Night" {
		t.Fatalf("history: %v", history)
	}

	// Codes expire after 30 minutes, and a suspended member cannot be checked in.
	if _, err = db.Exec(ctx, `UPDATE member_checkin_codes SET updated_at = NOW() - INTERVAL '31 minutes' WHERE user_id=$1`, memberID); err != nil {
		t.Fatal(err)
	}
	req("POST", "/admin/checkins/verify", map[string]string{"code": code, "eventId": eventID}, usher, 404)
	fresh := req("GET", "/checkin/code", nil, member, 200)["code"].(string)
	req("POST", "/admin/sa/users/"+memberID+"/suspend", nil, admin, 200)
	req("POST", "/admin/checkins/verify", map[string]string{"code": fresh, "eventId": eventID}, usher, 404)
	req("POST", "/admin/sa/users/"+memberID+"/suspend", nil, admin, 200)

	// Taking the permission away closes the door at once.
	req("PATCH", "/admin/members/"+created["id"].(string)+"/permissions", map[string]any{"permissions": []string{}}, admin, 200)
	req("GET", "/admin/checkins/recent", nil, usher, 403)
}
