package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestFreshDatabaseAuthHomeAdminAndNotifications(t *testing.T) {
	baseURL := os.Getenv("TEST_DATABASE_URL")
	if baseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	dbURL := createTempDatabase(t, ctx, baseURL)

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect temp db: %v", err)
	}
	defer db.Close()

	if err := database.RunMigrations(ctx, db, "../../migrations"); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	gin.SetMode(gin.TestMode)
	app := server.New(config.Config{
		AppEnv:      "test",
		HTTPAddr:    ":0",
		DatabaseURL: dbURL,
		JWTSecret:   "test-secret",
	}, db)

	assertStatus(t, app, http.MethodGet, "/healthz", nil, "", http.StatusOK)

	homeBody := assertStatus(t, app, http.MethodGet, "/api/v1/home", nil, "", http.StatusOK)
	if !strings.Contains(homeBody, "Scripture of the Day") {
		t.Fatalf("expected seeded home content, got %s", homeBody)
	}

	loginBody := assertStatus(
		t,
		app,
		http.MethodPost,
		"/api/v1/auth/login",
		map[string]string{"email": "vincent@example.com", "password": "password123"},
		"",
		http.StatusOK,
	)

	var loginResponse struct {
		Token string `json:"token"`
		User  struct {
			Role                  string `json:"role"`
			PasswordResetRequired bool   `json:"passwordResetRequired"`
		} `json:"user"`
	}
	if err := json.Unmarshal([]byte(loginBody), &loginResponse); err != nil {
		t.Fatalf("decode login response: %v", err)
	}

	if loginResponse.Token == "" {
		t.Fatal("expected login token")
	}
	if loginResponse.User.Role != "admin" {
		t.Fatalf("expected seeded admin role, got %q", loginResponse.User.Role)
	}
	if !loginResponse.User.PasswordResetRequired {
		t.Fatal("expected seeded admin to require password reset")
	}

	assertStatus(t, app, http.MethodGet, "/api/v1/admin/healthz", nil, loginResponse.Token, http.StatusForbidden)

	resetBody := assertStatus(
		t,
		app,
		http.MethodPatch,
		"/api/v1/auth/password",
		map[string]string{"currentPassword": "password123", "newPassword": "Phase12Secure!"},
		loginResponse.Token,
		http.StatusOK,
	)

	var resetResponse struct {
		Token string `json:"token"`
		User  struct {
			PasswordResetRequired bool `json:"passwordResetRequired"`
		} `json:"user"`
	}
	if err := json.Unmarshal([]byte(resetBody), &resetResponse); err != nil {
		t.Fatalf("decode reset response: %v", err)
	}
	if resetResponse.Token == "" || resetResponse.User.PasswordResetRequired {
		t.Fatalf("expected password reset to clear reset flag, got %s", resetBody)
	}

	assertStatus(t, app, http.MethodGet, "/api/v1/admin/healthz", nil, resetResponse.Token, http.StatusOK)
	assertStatus(t, app, http.MethodGet, "/api/v1/admin/notifications/messages", nil, resetResponse.Token, http.StatusOK)
}

func createTempDatabase(t *testing.T, ctx context.Context, baseURL string) string {
	t.Helper()

	adminURL, dbName := tempDatabaseURL(t, baseURL)

	adminDB, err := pgxpool.New(ctx, adminURL)
	if err != nil {
		t.Fatalf("connect admin db: %v", err)
	}
	defer adminDB.Close()

	quotedName := pgx.Identifier{dbName}.Sanitize()
	if _, err := adminDB.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s", quotedName)); err != nil {
		t.Fatalf("create temp db: %v", err)
	}

	t.Cleanup(func() {
		dropCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		adminDB, err := pgxpool.New(dropCtx, adminURL)
		if err != nil {
			t.Logf("connect admin db for cleanup: %v", err)
			return
		}
		defer adminDB.Close()

		_, _ = adminDB.Exec(dropCtx, fmt.Sprintf("DROP DATABASE IF EXISTS %s WITH (FORCE)", quotedName))
	})

	parsed, err := url.Parse(baseURL)
	if err != nil {
		t.Fatalf("parse base db url: %v", err)
	}
	parsed.Path = "/" + dbName

	return parsed.String()
}

func tempDatabaseURL(t *testing.T, baseURL string) (string, string) {
	t.Helper()

	parsed, err := url.Parse(baseURL)
	if err != nil {
		t.Fatalf("parse test database url: %v", err)
	}

	dbName := fmt.Sprintf("shekinah_test_%d", time.Now().UnixNano())
	parsed.Path = "/postgres"

	return parsed.String(), dbName
}

func assertStatus(
	t *testing.T,
	app http.Handler,
	method string,
	path string,
	payload any,
	token string,
	want int,
) string {
	t.Helper()

	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else {
		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		body = bytes.NewReader(data)
	}

	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Accept", "application/json")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	recorder := httptest.NewRecorder()
	app.ServeHTTP(recorder, req)

	if recorder.Code != want {
		t.Fatalf("%s %s: expected %d, got %d: %s", method, path, want, recorder.Code, recorder.Body.String())
	}

	return recorder.Body.String()
}
