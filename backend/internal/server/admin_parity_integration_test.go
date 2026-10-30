package server_test

import (
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

func TestAdminParityIncomeClassificationRolesAndServeHistory(t *testing.T) {
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("set TEST_DATABASE_URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
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
	kicked := map[string]bool{}
	media := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "PATCH":
			w.WriteHeader(200)
		case r.URL.Path == "/v3/rtmp/conns/list":
			_, _ = w.Write([]byte(`{"items":[{"id":"native-fixture","state":"publish"}]}`))
		case r.URL.Path == "/v3/webrtc/sessions/list":
			_, _ = w.Write([]byte(`{"items":[{"id":"browser-fixture","state":"publish"}]}`))
		case strings.Contains(r.URL.Path, "/kick/"):
			kicked[r.URL.Path] = true
			w.WriteHeader(200)
		default:
			w.WriteHeader(404)
		}
	}))
	defer media.Close()
	t.Setenv("LIVE_MEDIAMTX_API", media.URL)
	t.Setenv("LIVE_WHIP_URL", "http://127.0.0.1:18889")
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "admin-parity-fixture"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		if json.Unmarshal([]byte(raw), &out) != nil {
			t.Fatal(raw)
		}
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "ParityAdmin123!"}, login["token"].(string), 200)["token"].(string)
	reg := req("POST", "/auth/register", map[string]string{"name": "Parity Staff", "email": "parity@example.invalid", "password": "ParityMember123!"}, "", 201)
	member, id := reg["token"].(string), reg["user"].(map[string]any)["id"].(string)
	req("GET", "/admin/giving/analytics", nil, member, 403)
	req("PATCH", "/admin/members/"+id+"/permissions", map[string]any{"permissions": []string{"finance:manage", "live:moderate"}}, admin, 200)
	req("GET", "/admin/giving/analytics", nil, member, 200)
	req("GET", "/admin/members", nil, member, 403)
	req("PUT", "/admin/settings/ministry", map[string]string{}, member, 403)
	_, err = db.Exec(ctx, `INSERT INTO community_messages(id,user_id,channel,display_name,message,status)VALUES('global-parity-qa',$1,'global','Member','Private community fixture','approved'),('live-parity-qa',$1,'live','Member','Live fixture','approved')`, id)
	if err != nil {
		t.Fatal(err)
	}
	messages := req("GET", "/live/chat/messages?channel=global", nil, member, 200)["messages"].([]any)
	foundLive := false
	for _, m := range messages {
		row := m.(map[string]any)
		if row["channel"] != "live" {
			t.Fatal("live moderator accessed another channel")
		}
		if row["id"] == "live-parity-qa" {
			foundLive = true
		}
		if row["userEmail"] != nil {
			t.Fatal("member email leaked to live moderation")
		}
	}
	if !foundLive {
		t.Fatal("new live comment missing")
	}
	req("POST", "/live/chat/messages/global-parity-qa/hide", map[string]any{}, member, 404)
	req("POST", "/live/chat/messages/live-parity-qa/pin", map[string]any{"pinned": true}, member, 200)
	req("POST", "/live/chat/messages/global-parity-qa/pin", map[string]any{"pinned": true}, member, 404)
	var pinned bool
	_ = db.QueryRow(ctx, `SELECT pinned FROM community_messages WHERE id='live-parity-qa'`).Scan(&pinned)
	if !pinned {
		t.Fatal("invalid pin cleared an existing valid pin")
	}
	req("POST", "/live/start", map[string]any{"title": "No permission", "price": 200}, member, 403)
	req("PATCH", "/admin/members/"+id+"/permissions", map[string]any{"permissions": []string{"finance:manage", "live:moderate", "live:broadcast"}}, admin, 200)
	req("POST", "/live/start", map[string]any{"price": -1}, member, 400)
	req("POST", "/live/start", map[string]any{"price": "invalid"}, member, 400)
	broadcast := req("POST", "/live/start", map[string]any{"title": "Paid browser fixture", "price": 250}, member, 201)
	if !strings.HasPrefix(broadcast["whipUrl"].(string), "http://127.0.0.1:18889/church/whip?key=") {
		t.Fatal("browser publishing missing")
	}
	if broadcast["session"].(map[string]any)["price"] != float64(250) {
		t.Fatal("paid broadcast became free")
	}
	req("POST", "/live/stop", map[string]any{"sessionId": "outdated-browser-session"}, member, 409)
	if req("GET", "/live/current", nil, member, 200)["session"] == nil {
		t.Fatal("stale browser cleanup ended the current service")
	}
	req("POST", "/live/stop", map[string]any{"sessionId": broadcast["session"].(map[string]any)["id"]}, member, 200)
	if !kicked["/v3/rtmp/conns/kick/native-fixture"] || !kicked["/v3/webrtc/sessions/kick/browser-fixture"] {
		t.Fatal("ending service did not disconnect both publishing protocols")
	}

	// Deterministic financial fixtures: amounts and Nairobi midnight boundary.
	for _, sql := range []string{
		`DELETE FROM giving_transactions`,
		`INSERT INTO library_items(id,title,file_key,price)VALUES('book-income-qa','=2+3','encrypted-fixture',200)`,
		`INSERT INTO events(id,title,event_date,event_time,location)VALUES('event-income-qa','Conference','2026-10-29','10:00','Nairobi')`,
		`INSERT INTO live_sessions(id,title,stream_key,status,price,started_at,ended_at)VALUES('live-income-qa','Service','income-key','ended',300,'2026-10-28T08:00Z','2026-10-28T12:00Z')`,
	} {
		if _, err = db.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	type payment struct {
		id, item, status, currency, at string
		amount                         int
	}
	fixtures := []payment{
		{"gift", "", "success", "KES", "2026-10-28T07:00Z", 100},
		{"book", "book-income-qa", "success", "KES", "2026-10-28T08:00Z", 200},
		{"event", "event-income-qa", "success", "KES", "2026-10-28T09:00Z", 500},
		{"live", "live-income-qa", "success", "KES", "2026-10-28T10:00Z", 300},
		{"replay", "live-income-qa", "success", "KES", "2026-10-28T13:00Z", 300},
		{"pending", "book-income-qa", "awaiting_verification", "KES", "2026-10-28T14:00Z", 200},
		{"failed", "event-income-qa", "failed", "KES", "2026-10-28T15:00Z", 500},
		{"cancelled", "live-income-qa", "cancelled", "KES", "2026-10-28T16:00Z", 300},
		{"foreign", "book-income-qa", "success", "USD", "2026-10-28T17:00Z", 5},
		{"next-day", "", "success", "KES", "2026-10-28T21:00Z", 999},
	}
	for _, p := range fixtures {
		if _, err = db.Exec(ctx, `INSERT INTO giving_transactions(id,item_id,category,method,phone,status,currency,created_at,amount,user_id)VALUES($1,$2,'Fixture','bank','0700000000',$3,$4,$5,$6,$7)`, p.id, p.item, p.status, p.currency, p.at, p.amount, id); err != nil {
			t.Fatal(err)
		}
	}
	path := "/admin/giving/analytics?from=2026-10-28&to=2026-10-28&currency=KES"
	report := req("GET", path, nil, member, 200)
	totals := report["totals"].(map[string]any)
	for k, want := range map[string]float64{"confirmed": 1400, "pending": 200, "failed": 500, "cancelled": 300, "sales": 5, "transactions": 8} {
		if totals[k] != want {
			t.Fatalf("%s: got %v want %v", k, totals[k], want)
		}
	}
	streams := map[string]float64{}
	var sum float64
	for _, r := range report["streams"].([]any) {
		m := r.(map[string]any)
		streams[m["kind"].(string)] = m["confirmed"].(float64)
		sum += m["confirmed"].(float64)
	}
	for k, want := range map[string]float64{"donations": 100, "books": 200, "events": 500, "live": 300, "replays": 300, "other": 0} {
		if streams[k] != want {
			t.Fatal("misclassified", k, streams)
		}
	}
	if sum != totals["confirmed"] {
		t.Fatal("income did not reconcile")
	}
	bookReport := req("GET", path+"&item=book-income-qa", nil, member, 200)
	if bookReport["totals"].(map[string]any)["confirmed"] != float64(200) || bookReport["totals"].(map[string]any)["pending"] != float64(200) {
		t.Fatal("item drill-down mixed payments")
	}
	liveReport := req("GET", path+"&item=live-income-qa", nil, member, 200)
	if liveReport["totals"].(map[string]any)["confirmed"] != float64(600) || liveReport["totals"].(map[string]any)["sales"] != float64(2) {
		t.Fatal("live/replay drill-down duplicated entitlement")
	}
	foreign := req("GET", "/admin/giving/analytics?from=2026-10-28&to=2026-10-28&currency=USD", nil, member, 200)
	if foreign["totals"].(map[string]any)["confirmed"] != float64(5) {
		t.Fatal("currencies mixed")
	}
	req("GET", "/admin/giving/analytics?from=2026-10-29&to=2026-10-28", nil, member, 400)
	req("GET", "/admin/giving/analytics?currency=K1S", nil, member, 400)
	csv := assertStatus(t, app, "GET", "/api/v1"+path+"&format=csv", nil, member, 200)
	if !strings.Contains(csv, "'=2+3") || strings.Contains(csv, "0700000000") {
		t.Fatal("unsafe CSV or private payment details leaked")
	}
	// Overview must never call tickets or live sales book sales.
	_, err = db.Exec(ctx, `UPDATE giving_transactions SET created_at=NOW() WHERE id IN ('gift','book','event','live')`)
	if err != nil {
		t.Fatal(err)
	}
	o := req("GET", "/admin/overview", nil, admin, 200)
	// The second donation/replay/foreign book remain in the same calendar month.
	if o["givenThisMonth"] != float64(1099) || o["bookSalesMonth"] != float64(2) {
		t.Fatalf("overview misclassified income: %v", o)
	}
	// Archiving a team preserves its requests and member placement history.
	team := req("PUT", "/admin/serve/teams/new", map[string]any{"name": "Parity team", "isActive": true}, admin, 200)["id"].(string)
	_, err = db.Exec(ctx, `INSERT INTO serve_requests(id,team_id,user_id,phone,status)VALUES('serve-parity-qa',$1,$2,'0700000000','placed')`, team, id)
	if err != nil {
		t.Fatal(err)
	}
	req("DELETE", "/admin/serve/teams/"+team, nil, admin, 200)
	var count int
	if err = db.QueryRow(ctx, `SELECT count(*)FROM serve_requests WHERE id='serve-parity-qa'`).Scan(&count); err != nil || count != 1 {
		t.Fatal("team deletion lost requests")
	}
	var active bool
	_ = db.QueryRow(ctx, `SELECT is_active FROM serve_teams WHERE id=$1`, team).Scan(&active)
	if active {
		t.Fatal("archived team still accepting requests")
	}
	// Include account status in Users without changing role or grants.
	_, err = db.Exec(ctx, `UPDATE users SET is_active=FALSE WHERE id=$1`, id)
	if err != nil {
		t.Fatal(err)
	}
	users := req("GET", "/admin/members?query=parity@example.invalid", nil, admin, 200)["members"].([]any)
	if len(users) != 1 || users[0].(map[string]any)["isActive"] != false {
		t.Fatal("inactive account missing from Users")
	}
}
