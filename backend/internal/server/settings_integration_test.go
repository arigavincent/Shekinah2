package server_test

import (
	"context"
	"encoding/json"
	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	mailer "github.com/ariga/shekinah-backend/internal/mail"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
	"time"
)

func TestAdminRuntimeSMTPAndProductionSettings(t *testing.T) {
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("set TEST_DATABASE_URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	db, e := pgxpool.New(ctx, createTempDatabase(t, ctx, base))
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	if e = database.RunMigrations(ctx, db, "../../migrations"); e != nil {
		t.Fatal(e)
	}
	mailbox := localMailSink(t)
	host, port, from := os.Getenv("SMTP_HOST"), os.Getenv("SMTP_PORT"), os.Getenv("SMTP_FROM")
	gin.SetMode(gin.TestMode)
	cfg := config.Config{AppEnv: "test", JWTSecret: "settings-encryption-fixture"}
	app := server.New(cfg, db)
	object := func(body string) map[string]any {
		var m map[string]any
		if json.Unmarshal([]byte(body), &m) != nil {
			t.Fatal("invalid JSON response")
		}
		return m
	}
	req := func(method, path string, body any, token string, status int) map[string]any {
		return object(assertStatus(t, app, method, "/api/v1"+path, body, token, status))
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "SettingsAdmin123!"}, login["token"].(string), 200)["token"].(string)
	reg := req("POST", "/auth/register", map[string]string{"name": "Settings Member", "email": "settings.member@example.invalid", "password": "SettingsMember123!"}, "", 201)
	member := reg["token"].(string)
	id := reg["user"].(map[string]any)["id"].(string)
	req("GET", "/admin/settings/smtp", nil, "", 401)
	req("GET", "/admin/settings/smtp", nil, member, 403)
	req("PATCH", "/admin/members/"+id+"/permissions", map[string]any{"permissions": []string{"finance:manage", "sermons:manage"}}, admin, 200)
	req("GET", "/admin/settings/smtp", nil, member, 403)
	req("PUT", "/admin/settings/production", map[string]string{}, member, 403)
	env := req("GET", "/admin/settings/smtp", nil, admin, 200)["smtp"].(map[string]any)
	if env["source"] != "environment" {
		t.Fatal("missing environment fallback")
	}
	body := map[string]any{"enabled": false, "host": host, "port": port, "from": from, "username": "qa-user", "password": "private-smtp-password", "security": "none"}
	result := req("PUT", "/admin/settings/smtp", body, admin, 200)["smtp"].(map[string]any)
	if result["passwordConfigured"] != true {
		t.Fatal("saved password status absent")
	}
	if _, ok := result["password"]; ok {
		t.Fatal("password leaked in save response")
	}
	raw := assertStatus(t, app, "GET", "/api/v1/admin/settings/smtp", nil, admin, 200)
	if strings.Contains(raw, "private-smtp-password") {
		t.Fatal("password leaked in GET")
	}
	var stored string
	if e = db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key='smtp_configuration_v1'`).Scan(&stored); e != nil {
		t.Fatal(e)
	}
	if strings.Contains(stored, "private-smtp-password") || strings.Contains(stored, "qa-user") {
		t.Fatal("SMTP settings stored as plaintext")
	}
	body["password"] = ""
	body["host"] = "localhost"
	req("PUT", "/admin/settings/smtp", body, admin, 200)
	configStore := mailer.Store{DB: db, Secret: cfg.JWTSecret}
	saved, _, e := configStore.Load(ctx)
	if e != nil || saved.Password != "private-smtp-password" {
		t.Fatal("blank password replaced the saved password")
	}
	if _, _, e = (mailer.Store{DB: db, Secret: "different-key"}).Load(ctx); e == nil {
		t.Fatal("wrong key decrypted SMTP settings")
	}
	body["enabled"] = true
	body["username"] = ""
	body["clearPassword"] = true
	body["host"] = host
	req("PUT", "/admin/settings/smtp", body, admin, 200)
	// Environment is intentionally unusable now; real mail must use the saved DB configuration.
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_FROM", "")
	req("POST", "/admin/settings/smtp/check", nil, admin, 200)
	select {
	case <-mailbox:
		t.Fatal("connection check sent an email")
	default:
	}
	app = server.New(cfg, db)
	req("POST", "/auth/password-reset/request", map[string]string{"email": "settings.member@example.invalid"}, "", 200)
	if got := receiveMail(t, mailbox); !strings.Contains(got, "password reset code") {
		t.Fatal("password reset ignored saved SMTP settings")
	}
	teamID := req("PUT", "/admin/serve/teams/new", map[string]any{"name": "Runtime SMTP Team", "leaderName": "QA", "leaderEmail": "leader@example.invalid", "isActive": true}, admin, 200)["id"].(string)
	req("POST", "/serve/requests", map[string]string{"teamId": teamID, "phone": "0700000000", "availability": "Sundays", "message": "Runtime SMTP verification"}, member, 201)
	if got := receiveMail(t, mailbox); !strings.Contains(got, "Runtime SMTP verification") {
		t.Fatal("Serve emails ignored saved SMTP settings")
	}
	if req("GET", "/admin/serve", nil, admin, 200)["emailReady"] != true {
		t.Fatal("Serve readiness ignored saved SMTP settings")
	}
	body["security"] = "none"
	body["host"] = "smtp.remote.test"
	req("PUT", "/admin/settings/smtp", body, admin, 400)
	body["host"] = host
	body["from"] = "sender@test.invalid\r\nBcc: injected@test.invalid"
	req("PUT", "/admin/settings/smtp", body, admin, 400)
	prod := map[string]string{"apiUrl": "http://insecure.test", "dashboardUrl": "", "appUrl": "", "websiteUrl": ""}
	req("PUT", "/admin/settings/production", prod, admin, 400)
	prod["apiUrl"] = "https://api.ministry.test/api/v1"
	req("PUT", "/admin/settings/production", prod, admin, 400)
	prod = map[string]string{"apiUrl": "https://api.ministry.test/", "dashboardUrl": "https://admin.ministry.test", "appUrl": "https://ministry.test/app", "websiteUrl": "https://ministry.test"}
	req("PUT", "/admin/settings/production", prod, admin, 200)
	published := req("GET", "/settings/ministry", nil, "", 200)["ministry"].(map[string]any)
	if published["appUrl"] != prod["appUrl"] || published["website"] != prod["websiteUrl"] {
		t.Fatal("member app links did not update")
	}
	if req("GET", "/admin/settings/production", nil, admin, 200)["production"].(map[string]any)["apiUrl"] != "https://api.ministry.test" {
		t.Fatal("production API origin not normalized")
	}
}
