package server_test

import (
	"context"
	"encoding/json"
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

// Members learn they are in a group (notification + "My groups"), and only
// the group's leaders can see who else is in it.
func TestMyGroupsEndToEnd(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "my-groups-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "SuperAdmin123!"}, login["token"].(string), 200)["token"].(string)
	if _, err = db.Exec(ctx, `UPDATE users SET role='super_admin' WHERE email='vincent@example.com'`); err != nil {
		t.Fatal(err)
	}
	register := func(name, email, phone string) (string, string) {
		r := req("POST", "/auth/register", map[string]string{"name": name, "email": email, "phone": phone, "password": "MemberPass123!"}, "", 201)
		return r["token"].(string), r["user"].(map[string]any)["id"].(string)
	}
	leader, leaderID := register("Peter Leader", "peter.leader@example.invalid", "0711 000 001")
	member, memberID := register("Mary Member", "mary.member@example.invalid", "0711 000 002")
	other, _ := register("Outside Person", "outside@example.invalid", "0711 000 003")

	if g := req("GET", "/me/groups", nil, member, 200)["groups"].([]any); len(g) != 0 {
		t.Fatalf("expected no groups yet: %v", g)
	}
	req("GET", "/me/groups", nil, "", 401)

	group := req("PUT", "/admin/sa/groups", map[string]any{"name": "Ushers", "type": "ministry", "leaderId": leaderID, "schedule": "Saturdays 4 PM", "location": "Church hall"}, admin, 200)
	groupID := group["id"].(string)
	added := req("POST", "/admin/sa/groups/"+groupID+"/roster", map[string]string{"userId": memberID}, admin, 200)
	if added["joined"] != true {
		t.Fatalf("first add should be a join: %v", added)
	}
	// Changing their role is not a new join.
	if again := req("POST", "/admin/sa/groups/"+groupID+"/roster", map[string]string{"userId": memberID, "role": "assistant"}, admin, 200); again["joined"] != false {
		t.Fatalf("role change counted as join: %v", again)
	}
	req("POST", "/admin/sa/groups/"+groupID+"/roster", map[string]string{"userId": memberID, "role": "member"}, admin, 200)

	// The member was told, once, with the leader and meeting time.
	feed := req("GET", "/notifications/feed", nil, member, 200)["messages"].([]any)
	welcomes := 0
	for _, m := range feed {
		n := m.(map[string]any)
		if n["title"] == "Welcome to Ushers" {
			welcomes++
			if b := n["body"].(string); !strings.Contains(b, "Peter Leader") || !strings.Contains(b, "Saturdays 4 PM") {
				t.Fatalf("welcome body: %q", b)
			}
		}
	}
	if welcomes != 1 {
		t.Fatalf("expected one welcome notification, got %d", welcomes)
	}
	// Others don't see it.
	for _, m := range req("GET", "/notifications/feed", nil, other, 200)["messages"].([]any) {
		if m.(map[string]any)["title"] == "Welcome to Ushers" {
			t.Fatal("welcome leaked to someone outside the group")
		}
	}

	// "My groups" shows the group with the leader's contact.
	mine := req("GET", "/me/groups", nil, member, 200)["groups"].([]any)
	if len(mine) != 1 {
		t.Fatalf("my groups: %v", mine)
	}
	g := mine[0].(map[string]any)
	if g["name"] != "Ushers" || g["role"] != "member" || g["leaderName"] != "Peter Leader" || g["leaderPhone"] != "+254711000001" || g["schedule"] != "Saturdays 4 PM" || g["memberCount"] != float64(2) {
		t.Fatalf("group card: %v", g)
	}
	if lg := req("GET", "/me/groups", nil, leader, 200)["groups"].([]any); len(lg) != 1 || lg[0].(map[string]any)["role"] != "leader" {
		t.Fatalf("leader's groups: %v", lg)
	}

	// Only leaders see who is in the group.
	req("GET", "/me/groups/"+groupID+"/members", nil, member, 403)
	req("GET", "/me/groups/"+groupID+"/members", nil, other, 403)
	people := req("GET", "/me/groups/"+groupID+"/members", nil, leader, 200)["members"].([]any)
	if len(people) != 2 || people[0].(map[string]any)["role"] != "leader" || people[1].(map[string]any)["phone"] != "+254711000002" {
		t.Fatalf("leader roster: %v", people)
	}

	// Removed or archived groups disappear from "My groups".
	req("DELETE", "/admin/sa/groups/"+groupID+"/roster/"+memberID, nil, admin, 200)
	if g := req("GET", "/me/groups", nil, member, 200)["groups"].([]any); len(g) != 0 {
		t.Fatalf("removed member still sees the group: %v", g)
	}
	req("DELETE", "/admin/sa/groups/"+groupID+"?mode=soft", nil, admin, 200)
	if g := req("GET", "/me/groups", nil, leader, 200)["groups"].([]any); len(g) != 0 {
		t.Fatalf("archived group still shown: %v", g)
	}
	req("GET", "/me/groups/"+groupID+"/members", nil, leader, 403)
}
