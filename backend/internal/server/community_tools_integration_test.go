package server_test

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestFamiliesTargetedMessagesKeyRotationAndEventControls(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "community-tools-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "ToolsAdmin123!"}, login["token"].(string), 200)["token"].(string)
	if _, err = db.Exec(ctx, `UPDATE users SET role='super_admin' WHERE email='vincent@example.com'`); err != nil {
		t.Fatal(err)
	}
	member := func(name, email string) (string, string) {
		r := req("POST", "/auth/register", map[string]string{"name": name, "email": email, "password": "MemberPass123!"}, "", 201)
		return r["token"].(string), r["user"].(map[string]any)["id"].(string)
	}
	choirTok, choirID := member("Choir Member", "choir@example.invalid")
	otherTok, otherID := member("Other Member", "other@example.invalid")

	// Families.
	fam := req("PUT", "/admin/sa/families", map[string]string{"name": "The Otieno family", "address": "Kisumu"}, admin, 200)["id"].(string)
	req("PUT", "/admin/sa/users/"+choirID+"/family", map[string]string{"familyId": fam, "familyRole": "head"}, admin, 200)
	req("PUT", "/admin/sa/users/"+otherID+"/family", map[string]string{"familyId": fam, "familyRole": "uncle"}, admin, 400)
	req("PUT", "/admin/sa/users/"+otherID+"/family", map[string]string{"familyId": fam, "familyRole": "child"}, admin, 200)
	families := req("GET", "/admin/sa/families", nil, admin, 200)["families"].([]any)
	if members := families[0].(map[string]any)["members"].([]any); len(members) != 2 || members[0].(map[string]any)["familyRole"] != "head" {
		t.Fatalf("family members %v", members)
	}

	// Messages reach only their audience, in push and in the feed.
	group := req("PUT", "/admin/sa/groups", map[string]any{"name": "Choir", "type": "ministry"}, admin, 200)["id"].(string)
	req("POST", "/admin/sa/groups/"+group+"/roster", map[string]string{"userId": choirID}, admin, 200)
	req("POST", "/admin/sa/messages", map[string]any{"title": "Choir practice", "body": "Saturday 4pm", "audience": "group", "targetId": group, "channels": []string{"push"}}, admin, 200)
	req("POST", "/admin/sa/messages", map[string]any{"title": "Email only", "body": "x", "channels": []string{"email"}}, admin, 503)
	req("POST", "/admin/sa/messages", map[string]any{"title": "Church picnic", "body": "Next month", "audience": "all", "channels": []string{"push"}}, admin, 200)
	feed := func(token string) map[string]bool {
		seen := map[string]bool{}
		for _, m := range req("GET", "/notifications/feed", nil, token, 200)["messages"].([]any) {
			seen[m.(map[string]any)["title"].(string)] = true
		}
		return seen
	}
	if f := feed(choirTok); !f["Choir practice"] || !f["Church picnic"] {
		t.Fatalf("choir feed %v", f)
	}
	if f := feed(otherTok); f["Choir practice"] || !f["Church picnic"] {
		t.Fatalf("other feed %v", f)
	}
	if f := feed(""); f["Choir practice"] || !f["Church picnic"] {
		t.Fatalf("guest feed %v", f)
	}
	log := req("GET", "/admin/sa/messages", nil, admin, 200)["messages"].([]any)
	if len(log) < 2 || log[1].(map[string]any)["audience"] != "Choir" {
		t.Fatalf("sent log %v", log)
	}

	// Rotating a key revokes the old secret and keeps its permissions.
	old := req("POST", "/admin/sa/api-keys", map[string]any{"name": "n8n", "permissions": []string{"events:manage"}}, admin, 201)
	fresh := req("POST", "/admin/sa/api-keys/"+old["id"].(string)+"/rotate", nil, admin, 201)["key"].(string)
	call := func(key string) int {
		r := httptest.NewRequest("GET", "/api/v1/admin/events", nil)
		r.Header.Set("X-API-Key", key)
		w := httptest.NewRecorder()
		app.ServeHTTP(w, r)
		return w.Code
	}
	if call(old["key"].(string)) != 401 || call(fresh) != 200 {
		t.Fatal("rotation should retire the old key and keep permissions")
	}

	// Events: deadline, capacity with voiding, staff-issued tickets, cancel/restore.
	var eventID string
	if err = db.QueryRow(ctx, `INSERT INTO events(id,title,event_date,event_time,location,image_url,description,registration,capacity,published_at,is_published)
		VALUES('evt-controls','Youth camp',CURRENT_DATE+7,'9 AM','Hall','','Camp','form',1,NOW(),TRUE) RETURNING id`).Scan(&eventID); err != nil {
		t.Fatal(err)
	}
	reg := req("POST", "/events/"+eventID+"/register", map[string]any{"answers": map[string]string{}}, choirTok, 200)
	_ = reg
	req("POST", "/events/"+eventID+"/register", map[string]any{"answers": map[string]string{}}, otherTok, 409)
	regs := req("GET", "/admin/events/"+eventID+"/registrations", nil, admin, 200)["registrations"].([]any)
	req("DELETE", "/admin/events/"+eventID+"/registrations/"+regs[0].(map[string]any)["id"].(string), nil, admin, 200)
	req("POST", "/events/"+eventID+"/register", map[string]any{"answers": map[string]string{}}, otherTok, 200)
	issued := req("POST", "/admin/events/"+eventID+"/registrations", map[string]string{"userId": choirID}, admin, 201)
	if issued["ticket"] == "" {
		t.Fatal("staff should be able to issue a ticket past capacity")
	}
	req("PUT", "/admin/events/"+eventID+"/deadline", map[string]string{"closesAt": time.Now().Add(-time.Hour).Format(time.RFC3339)}, admin, 200)
	_, latecomer := member("Late Member", "late@example.invalid")
	_ = latecomer
	lateTok := req("POST", "/auth/login", map[string]string{"email": "late@example.invalid", "password": "MemberPass123!"}, "", 200)["token"].(string)
	if out := req("POST", "/events/"+eventID+"/register", map[string]any{"answers": map[string]string{}}, lateTok, 409); out["message"] != "Registration for this event has closed." {
		t.Fatalf("deadline %v", out)
	}
	req("POST", "/admin/events/"+eventID+"/cancel", map[string]string{"reason": "Venue unavailable"}, admin, 200)
	home := req("GET", "/home", nil, "", 200)
	for _, e := range home["events"].([]any) {
		if e.(map[string]any)["id"] == eventID {
			t.Fatal("cancelled event still listed in the app")
		}
	}
	req("POST", "/admin/events/"+eventID+"/restore", nil, admin, 200)
}
