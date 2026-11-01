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

func TestTicketTiersAndReplayAdmin(t *testing.T) {
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
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "tiers-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "TiersAdmin123!"}, login["token"].(string), 200)["token"].(string)
	a := req("POST", "/auth/register", map[string]string{"name": "Member A", "email": "a@example.invalid", "password": "MemberA123!"}, "", 201)["token"].(string)
	b := req("POST", "/auth/register", map[string]string{"name": "Member B", "email": "b@example.invalid", "password": "MemberB123!"}, "", 201)["token"].(string)

	ev := req("POST", "/admin/events", map[string]any{"title": "Gala", "eventDate": "2030-01-01", "eventTime": "6:00 PM", "location": "Hall", "description": "x"}, admin, 201)
	id := ev["event"].(map[string]any)["id"].(string)
	setup := req("PUT", "/admin/events/"+id+"/registration", map[string]any{"mode": "none", "tiers": []map[string]any{
		{"name": "Regular", "price": 500, "capacity": 0}, {"name": "VIP", "price": 2000, "capacity": 1}}}, admin, 200)["setup"].(map[string]any)
	tiers := setup["tiers"].([]any)
	regular, vip := tiers[0].(map[string]any)["id"].(string), tiers[1].(map[string]any)["id"].(string)
	if setup["price"].(float64) != 500 {
		t.Fatalf("headline price %v", setup["price"])
	}
	req("PUT", "/admin/events/"+id+"/registration", map[string]any{"mode": "none", "tiers": []map[string]any{{"name": "A"}, {"name": "a"}}}, admin, 400)

	req("POST", "/events/"+id+"/register", map[string]any{}, a, 400) // must choose a type
	mine := req("POST", "/events/"+id+"/register", map[string]any{"tierId": vip}, a, 200)["mine"].(map[string]any)
	if mine["tier"] != "VIP" || mine["price"].(float64) != 2000 || mine["ticket"] != nil {
		t.Fatalf("vip registration %v", mine)
	}
	req("POST", "/events/"+id+"/register", map[string]any{"tierId": vip}, b, 409) // VIP sold out
	req("POST", "/events/"+id+"/register", map[string]any{"tierId": regular}, b, 200)
	info := req("GET", "/events/"+id+"/registration", nil, b, 200)
	if left := info["setup"].(map[string]any)["tiers"].([]any)[1].(map[string]any)["spotsLeft"].(float64); left != 0 {
		t.Fatalf("vip spots left %v", left)
	}
	// Paying charges the tier's price.
	req("POST", "/giving/confirm", map[string]any{"method": "mpesa_paybill", "reference": "TIERTEST01", "itemId": id, "phone": "0712345678", "name": "A"}, a, 201)
	var amount int
	if err = db.QueryRow(ctx, `SELECT amount FROM giving_transactions WHERE provider_reference='TIERTEST01'`).Scan(&amount); err != nil || amount != 2000 {
		t.Fatalf("charged %d (%v)", amount, err)
	}
	// Can't switch ticket type once a payment is in.
	req("POST", "/events/"+id+"/register", map[string]any{"tierId": regular}, a, 409)
	regs := req("GET", "/admin/events/"+id+"/registrations", nil, admin, 200)["registrations"].([]any)
	if len(regs) != 2 || regs[0].(map[string]any)["tierId"] == "" {
		t.Fatalf("registrations %v", regs)
	}

	// Replays: list, rename, describe, custom cover, delete.
	if _, err = db.Exec(ctx, `INSERT INTO live_sessions(id,title,stream_key,status,started_at,ended_at,transport) VALUES('live-aaaaaaaaaaaa','Old title','k1','ended',NOW(),NOW(),'r2');
		INSERT INTO live_archives(session_id,status,object_key) VALUES('live-aaaaaaaaaaaa','ready','r2-hls/live-aaaaaaaaaaaa')`); err != nil {
		t.Fatal(err)
	}
	items := req("GET", "/admin/replays", nil, admin, 200)["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("replays %v", items)
	}
	req("PATCH", "/admin/replays/live-aaaaaaaaaaaa", map[string]any{"title": "Sunday Glory", "description": "Pastor's word"}, a, 403)
	req("PATCH", "/admin/replays/live-aaaaaaaaaaaa", map[string]any{"title": "Sunday Glory", "description": "Pastor's word"}, admin, 200)
	out := req("PATCH", "/admin/replays/live-aaaaaaaaaaaa", map[string]any{"thumbnailUrl": "https://example.com/c.jpg"}, admin, 200)
	if out["customCover"] != true || out["thumbnailUrl"] != "https://example.com/c.jpg" {
		t.Fatalf("custom cover %v", out)
	}
	sermons := req("GET", "/home", nil, "", 200)
	raw, _ := json.Marshal(sermons)
	if !strings.Contains(string(raw), "Sunday Glory") || !strings.Contains(string(raw), "Pastor's word") {
		t.Fatalf("sermons missing renamed replay: %s", raw)
	}
	// Deleting needs storage configured; without it the recording stays.
	if os.Getenv("R2_ACCESS_KEY_ID") == "" {
		req("DELETE", "/admin/replays/live-aaaaaaaaaaaa", nil, admin, 503)
	}
}

