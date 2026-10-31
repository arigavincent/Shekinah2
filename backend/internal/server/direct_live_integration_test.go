package server_test

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestDirectLivePermissionsOrderingReplayAndRecovery(t *testing.T) {
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
	var key []byte
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			b := make([]byte, 384)
			b[0] = 0x47
			b[188] = 0x47
			iv := make([]byte, 16)
			if strings.Contains(r.URL.Path, "/000001-") {
				iv[15] = 2
			} else {
				iv[15] = 1
			}
			block, _ := aes.NewCipher(key)
			cipher.NewCBCEncrypter(block, iv).CryptBlocks(b, b)
			w.Header().Set("Content-Range", "bytes 0-383/384")
			w.WriteHeader(206)
			w.Write(b)
			return
		}
		w.WriteHeader(200)
	}))
	defer fake.Close()
	t.Setenv("R2_ENDPOINT", fake.URL)
	t.Setenv("R2_ACCESS_KEY_ID", "fixture")
	t.Setenv("R2_SECRET_ACCESS_KEY", "fixture")
	t.Setenv("R2_SERMONS_BUCKET", "fixture")
	t.Setenv("LIBRARY_ENCRYPTION_KEY", "fixture-encryption")
	t.Setenv("LIVE_TRANSPORT", "r2")
	t.Setenv("LIVE_R2_MAX_BYTES", "1152")
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "direct-live-test-root"}, db)
	req := func(method, path string, body any, token string, status int) map[string]any {
		raw := assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		var out map[string]any
		_ = json.Unmarshal([]byte(raw), &out)
		return out
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "DirectBroadcast123!"}, login["token"].(string), 200)["token"].(string)
	member := req("POST", "/auth/register", map[string]string{"name": "Viewer", "email": "direct-viewer@example.invalid", "password": "DirectViewer123!"}, "", 201)
	token := member["token"].(string)
	uid := member["user"].(map[string]any)["id"].(string)
	live := req("POST", "/live/start", map[string]any{"title": "Direct paid test", "price": 200, "transport": "r2", "format": "mpegts"}, admin, 201)
	key, _ = base64.StdEncoding.DecodeString(live["encryptionKey"].(string))
	id := live["session"].(map[string]any)["id"].(string)
	prefix := "/live/direct/" + id
	if live["transport"] != "r2" {
		t.Fatal("direct mode missing")
	}
	req("POST", prefix+"/segments", nil, "", 401)
	req("POST", prefix+"/segments", nil, token, 403)
	input := map[string]any{"sequence": 0, "size": 384, "sha256": strings.Repeat("a", 64), "duration": 3}
	reservation := req("POST", prefix+"/segments", input, admin, 200)
	if !strings.Contains(reservation["url"].(string), "X-Amz-Signature") {
		t.Fatal("upload not signed")
	}
	req("POST", prefix+"/segments", input, admin, 200)
	input["sha256"] = strings.Repeat("b", 64)
	req("POST", prefix+"/segments", input, admin, 409)
	input["sha256"] = strings.Repeat("a", 64)
	input["sequence"] = 2
	req("POST", prefix+"/segments", input, admin, 409)
	input["sequence"] = 0
	req("GET", prefix+"/index.m3u8", nil, "", 402)
	req("POST", prefix+"/segments/0/commit", nil, admin, 200)
	req("POST", prefix+"/segments/0/commit", nil, admin, 200)
	current := req("GET", "/live/current", nil, token, 200)["session"].(map[string]any)
	if current["status"] != "live" || current["access"] != false {
		t.Fatal("paid live access bypassed")
	}
	req("GET", prefix+"/index.m3u8", nil, token, 402)
	assertStatus(t, app, "GET", "/api/v1"+prefix+"/key", nil, token, 402)
	_, err = db.Exec(ctx, `INSERT INTO giving_transactions(id,user_id,amount,method,status,item_id,category,phone)VALUES('direct-paid-qa',$1,200,'manual','success',$2,'live','')`, uid, id)
	if err != nil {
		t.Fatal(err)
	}
	raw := assertStatus(t, app, "GET", "/api/v1"+prefix+"/index.m3u8?media=1", nil, token, 200)
	if !strings.Contains(raw, "#EXTINF:3.000000") || !strings.Contains(raw, "X-Amz-Signature") {
		t.Fatal("missing signed HLS segments")
	}
	if !strings.Contains(raw, "#EXT-X-START:TIME-OFFSET=-1.500,PRECISE=YES") {
		t.Fatal("live playback did not request the newest media")
	}
	input["sequence"] = 1
	req("POST", prefix+"/segments", input, admin, 200)
	req("POST", "/live/stop", map[string]any{"sessionId": "stale"}, admin, 409)
	req("POST", "/live/stop", map[string]any{"sessionId": id}, admin, 200)
	req("POST", prefix+"/segments/1/commit", nil, admin, 200) // delayed upload recovers after End
	raw = assertStatus(t, app, "GET", "/api/v1"+prefix+"/index.m3u8?media=1", nil, token, 200)
	if !strings.Contains(raw, "#EXT-X-ENDLIST") || strings.Count(raw, "#EXTINF:") != 2 {
		t.Fatal("replay lost delayed segment")
	}
	if strings.Contains(raw, "#EXT-X-START") {
		t.Fatal("replay incorrectly starts at the live edge")
	}
	replay := req("GET", "/live/replays", nil, token, 200)["items"].([]any)
	if len(replay) != 1 || replay[0].(map[string]any)["access"] != true || replay[0].(map[string]any)["status"] != "ready" {
		t.Fatal("original purchase did not carry into replay")
	}
	// New handler simulates process restart: playlist and ready state are in PostgreSQL.
	app = server.New(config.Config{AppEnv: "test", JWTSecret: "direct-live-test-root"}, db)
	assertStatus(t, app, "GET", "/api/v1"+prefix+"/index.m3u8?media=1", nil, token, 200)
	input["sequence"] = 2
	req("POST", prefix+"/segments", input, admin, 200)
	input["sequence"] = 3
	req("POST", prefix+"/segments", input, admin, 507)
	var n int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM live_segments WHERE session_id=$1`, id).Scan(&n)
	if n != 3 {
		t.Fatal(fmt.Sprintf("quota allocation wrong: %d", n))
	}
}
