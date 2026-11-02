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

func TestSermonNotesYouTubeAndPlaylists(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "sermon-extras-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "SermonExtras123!"}, login["token"].(string), 200)["token"].(string)
	member := req("POST", "/auth/register", map[string]string{"phone": "0712345678", "name": "Listener", "email": "listener@example.invalid", "password": "Listener12345!"}, "", 201)["token"].(string)
	other := req("POST", "/auth/register", map[string]string{"phone": "0712345679", "name": "Other", "email": "other.listener@example.invalid", "password": "Listener12345!"}, "", 201)["token"].(string)

	// A YouTube sermon: played with YouTube's player, its thumbnail used.
	req("POST", "/admin/sermons", map[string]any{"id": "ser-yt", "externalId": "yt-1", "type": "video", "title": "Faith that moves", "speaker": "Pastor", "sermonDate": "2026-10-01",
		"publishedAt": "2026-10-01T09:00", "description": "Overview of the message", "mediaUrl": "https://youtu.be/dQw4w9WgXcQ?si=x", "isPublished": true, "notifyOnPublish": false}, admin, 201)
	var found map[string]any
	for _, s := range req("GET", "/home", nil, "", 200)["sermons"].([]any) {
		if m := s.(map[string]any); m["id"] == "ser-yt" {
			found = m
		}
	}
	if found == nil || found["youtubeId"] != "dQw4w9WgXcQ" || found["thumbnail"] != "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" {
		t.Fatalf("youtube sermon %v", found)
	}

	// Notes: staff write them, everyone reads them.
	if n := req("GET", "/sermons/ser-yt/notes", nil, "", 200)["notes"]; n != "" {
		t.Fatalf("notes %v", n)
	}
	req("PUT", "/admin/sermons/ser-yt/notes", map[string]string{"notes": "Key points\n- Faith grows by hearing (Romans 10:17)"}, member, 403)
	req("PUT", "/admin/sermons/missing/notes", map[string]string{"notes": "x"}, admin, 404)
	req("PUT", "/admin/sermons/ser-yt/notes", map[string]string{"notes": "Key points\r\n- Faith grows by hearing (Romans 10:17)"}, admin, 200)
	if n := req("GET", "/sermons/ser-yt/notes", nil, "", 200)["notes"]; n != "Key points\n- Faith grows by hearing (Romans 10:17)" {
		t.Fatalf("notes %q", n)
	}

	// Playlists: a member's own, private to them; official ones for everyone.
	pl := req("POST", "/playlists", map[string]any{"name": "Faith series", "items": []string{"ser-yt", "ser-yt", " "}}, member, 201)["playlist"].(map[string]any)
	id := pl["id"].(string)
	if items := pl["items"].([]any); len(items) != 1 {
		t.Fatalf("items %v", items)
	}
	req("POST", "/playlists", map[string]any{"name": " "}, member, 400)
	req("POST", "/playlists", map[string]any{"name": "x"}, "", 401)
	req("PATCH", "/playlists/"+id, map[string]any{"name": "Faith & healing", "items": []string{"a", "ser-yt"}}, member, 200)
	req("PATCH", "/playlists/"+id, map[string]any{"name": "Stolen"}, other, 404)
	req("DELETE", "/playlists/"+id, nil, other, 404)
	official := req("POST", "/admin/playlists", map[string]any{"name": "Sons of God series", "items": []string{"ser-yt"}}, admin, 201)["playlist"].(map[string]any)["id"].(string)
	req("POST", "/admin/playlists", map[string]any{"name": "x"}, member, 403)
	mine := req("GET", "/playlists", nil, member, 200)["playlists"].([]any)
	if len(mine) != 2 || mine[0].(map[string]any)["official"] != true || mine[1].(map[string]any)["name"] != "Faith & healing" || mine[1].(map[string]any)["mine"] != true {
		t.Fatalf("member playlists %v", mine)
	}
	if theirs := req("GET", "/playlists", nil, other, 200)["playlists"].([]any); len(theirs) != 1 {
		t.Fatalf("other sees %v", theirs)
	}
	if anon := req("GET", "/playlists", nil, "", 200)["playlists"].([]any); len(anon) != 1 {
		t.Fatalf("signed out sees %v", anon)
	}
	req("PATCH", "/playlists/"+official, map[string]any{"name": "Hijack"}, member, 404)
	req("PATCH", "/admin/playlists/"+official, map[string]any{"items": []string{}}, admin, 200)
	req("DELETE", "/playlists/"+id, nil, member, 200)
	req("DELETE", "/admin/playlists/"+official, nil, admin, 200)
	if left := req("GET", "/playlists", nil, member, 200)["playlists"].([]any); len(left) != 0 {
		t.Fatalf("left %v", left)
	}
}
