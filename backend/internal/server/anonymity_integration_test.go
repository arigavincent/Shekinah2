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

// Anonymous prayer requests and testimonies stay anonymous to staff: no name,
// no email, nothing that points back to the person, in any admin response.
// The member still sees their own.
func TestAnonymousPrayersAndTestimoniesHideThePerson(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "anonymity-fixture"}, db)
	raw := func(method, path string, body any, token string, status int) string {
		return assertStatus(t, app, method, "/api/v1"+path, body, token, status)
	}
	obj := func(s string) map[string]any { var m map[string]any; _ = json.Unmarshal([]byte(s), &m); return m }

	login := obj(raw("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200))
	admin := obj(raw("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "SuperAdmin123!"}, login["token"].(string), 200))["token"].(string)
	if _, err = db.Exec(ctx, `UPDATE users SET role='super_admin' WHERE email='vincent@example.com'`); err != nil {
		t.Fatal(err)
	}
	reg := obj(raw("POST", "/auth/register", map[string]string{"name": "Secret Seeker", "email": "secret.seeker@example.invalid", "phone": "0711 222 333", "password": "MemberPass123!"}, "", 201))
	member := reg["token"].(string)
	userID := reg["user"].(map[string]any)["id"].(string)

	// Anonymous prayer: staff see "Anonymous" and nothing else about the person.
	raw("POST", "/prayer-requests", map[string]any{"category": "Family", "text": "Please pray for my marriage, it is very hard right now.", "isPublic": false, "anonymous": true}, member, 201)
	raw("POST", "/prayer-requests", map[string]any{"category": "Healing", "text": "Healing for my knee please, thank you church.", "isPublic": true, "anonymous": false}, member, 201)
	adminPrayers := raw("GET", "/admin/prayers", nil, admin, 200)
	found := false
	for _, p := range obj(adminPrayers)["prayers"].([]any) {
		m := p.(map[string]any)
		if strings.Contains(m["text"].(string), "my marriage") {
			found = true
			if m["name"] != "Anonymous" || m["ownerEmail"] != "" {
				t.Fatalf("anonymous prayer reveals the person: %v", m)
			}
		}
	}
	if !found {
		t.Fatal("anonymous prayer missing from admin list")
	}
	// Even the anonymous item's full data carries no trace of who they are.
	for _, p := range obj(adminPrayers)["prayers"].([]any) {
		item, _ := json.Marshal(p)
		if strings.Contains(string(item), "my marriage") {
			for _, leak := range []string{"secret.seeker@example.invalid", userID, "Secret Seeker"} {
				if strings.Contains(string(item), leak) {
					t.Fatalf("anonymous prayer leaks %q: %s", leak, item)
				}
			}
		}
	}
	var stored string
	_ = db.QueryRow(ctx, `SELECT owner_email FROM prayers WHERE text LIKE '%my marriage%'`).Scan(&stored)
	if stored != "" {
		t.Fatalf("anonymous prayer stored the email: %q", stored)
	}
	// A named prayer still shows who asked, so the team can follow up.
	if !strings.Contains(adminPrayers, "secret.seeker@example.invalid") {
		t.Fatal("named prayer lost its contact")
	}
	// The member still sees their anonymous request.
	if mine := raw("GET", "/prayer-requests/mine", nil, member, 200); !strings.Contains(mine, "my marriage") {
		t.Fatal("member can't see their own anonymous request")
	}

	// Anonymous testimony: staff see "Anonymous", no email.
	raw("POST", "/testimonies", map[string]any{"title": "Healed", "body": "God healed my back after years of pain. Praise Him!", "anonymous": true}, member, 201)
	list := raw("GET", "/admin/testimonies", nil, admin, 200)
	for _, tt := range obj(list)["testimonies"].([]any) {
		m := tt.(map[string]any)
		if m["title"] == "Healed" && (m["displayName"] != "Anonymous" || m["ownerEmail"] != nil && m["ownerEmail"] != "") {
			t.Fatalf("anonymous testimony reveals the person: %v", m)
		}
	}
	if strings.Contains(list, "Secret Seeker") || strings.Contains(list, "secret.seeker@example.invalid") {
		t.Fatalf("admin testimonies leak the person: %s", list)
	}
}
