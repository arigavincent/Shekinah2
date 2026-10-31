package server_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"github.com/go-pdf/fpdf"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/notifications"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPublishingRecoverySchedulingPermissionsAndReplayCatalogue(t *testing.T) {
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
	t.Setenv("UPLOAD_STAGING_DIR", t.TempDir())
	t.Setenv("NOTIFICATIONS_DELIVERY_ENABLED", "false")
	stored := map[string][]byte{}
	r2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "PUT" {
			b, _ := io.ReadAll(r.Body)
			stored[r.URL.Path] = b
			w.WriteHeader(200)
			return
		}
		w.WriteHeader(404)
	}))
	defer r2.Close()
	for k, v := range map[string]string{"R2_ENDPOINT": r2.URL, "R2_BUCKET": "qa", "R2_SERMONS_BUCKET": "qa", "R2_PUBLIC_BASE_URL": "https://media.example.invalid", "R2_SERMONS_PUBLIC_BASE_URL": "https://media.example.invalid", "R2_ACCESS_KEY_ID": "test-access", "R2_SECRET_ACCESS_KEY": "test-secret", "LIBRARY_ENCRYPTION_KEY": base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{42}, 32))} {
		t.Setenv(k, v)
	}
	gin.SetMode(gin.TestMode)
	cfg := config.Config{AppEnv: "test", JWTSecret: "publishing-test-secret"}
	app := server.New(cfg, db)
	object := func(b string) map[string]any {
		var m map[string]any
		if json.Unmarshal([]byte(b), &m) != nil {
			t.Fatal(b)
		}
		return m
	}
	req := func(method, path string, body any, token string, status int) map[string]any {
		return object(assertStatus(t, app, method, "/api/v1"+path, body, token, status))
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "PublisherAdmin123!"}, login["token"].(string), 200)["token"].(string)
	register := func(email string) (string, string) {
		r := req("POST", "/auth/register", map[string]string{"name": "Publishing QA", "email": email, "password": "PublisherMember123!"}, "", 201)
		return r["token"].(string), r["user"].(map[string]any)["id"].(string)
	}
	staff, staffID := register("publisher@example.invalid")
	member, memberID := register("reader@example.invalid")
	req("GET", "/admin/sermons", nil, staff, 403)
	req("PATCH", "/admin/members/"+staffID+"/permissions", map[string]any{"permissions": []string{"sermons:manage", "events:manage", "books:publish"}}, admin, 200)
	req("GET", "/admin/sermons", nil, staff, 200)
	req("GET", "/admin/giving/transactions", nil, staff, 403)
	req("GET", "/admin/members", nil, staff, 403)
	sermon := map[string]any{"id": "ser-batch-qa", "externalId": "upload-batch-qa", "type": "video", "title": "August service", "speaker": "Ministry", "sermonDate": "2026-08-01", "publishedAt": "2099-01-01T10:00", "description": "Backlog", "mediaUrl": "https://media.example.invalid/sermon.mp4", "notifyOnPublish": false}
	created := req("POST", "/admin/sermons", sermon, staff, 201)["sermon"].(map[string]any)
	if created["publishedAt"] != "2099-01-01T07:00:00Z" {
		t.Fatalf("Nairobi time converted incorrectly: %v", created["publishedAt"])
	}
	req("POST", "/admin/sermons", sermon, staff, 201)
	var count int
	_ = db.QueryRow(ctx, `SELECT count(*)FROM sermons WHERE id='ser-batch-qa'`).Scan(&count)
	if count != 1 {
		t.Fatal("retry duplicated sermon")
	}
	home := assertStatus(t, app, "GET", "/api/v1/home", nil, "", 200)
	if strings.Contains(home, "August service") {
		t.Fatal("future sermon visible")
	}
	req("PATCH", "/admin/sermons/ser-batch-qa", map[string]any{"publishedAt": "2026-08-01T10:00+03:00", "isPublished": false}, staff, 200)
	if strings.Contains(assertStatus(t, app, "GET", "/api/v1/home", nil, "", 200), "August service") {
		t.Fatal("draft sermon visible")
	}
	req("PATCH", "/admin/sermons/ser-batch-qa", map[string]any{"isPublished": true}, staff, 200)
	if !strings.Contains(assertStatus(t, app, "GET", "/api/v1/home", nil, "", 200), "August service") {
		t.Fatal("backlog sermon missing")
	}
	publisher := notifications.NewHandler(db)
	for i := 0; i < 4; i++ {
		if e = publisher.PublishNext(ctx); e != nil {
			t.Fatal(e)
		}
	}
	_ = db.QueryRow(ctx, `SELECT count(*)FROM notification_messages WHERE title='August service'`).Scan(&count)
	if count != 0 {
		t.Fatal("quiet import sent notification")
	}
	_ = db.QueryRow(ctx, `SELECT count(*)FROM staff_actions WHERE actor_id=$1 AND item_id='ser-batch-qa'`, staffID).Scan(&count)
	if count < 1 {
		t.Fatal("publisher attribution absent")
	}

	event := map[string]any{"id": "evt-batch-qa", "title": "Paid conference", "eventDate": "2026-08-03", "eventTime": "10:00", "location": "Nairobi", "description": "Custom event", "publishedAt": "2099-01-01T10:00", "registrationSetup": map[string]any{"mode": "link", "formUrl": "https://docs.google.com/forms/d/example", "price": 500, "capacity": 10, "fields": []any{}}}
	req("POST", "/admin/events", event, staff, 201)
	req("GET", "/events/evt-batch-qa/registration", nil, member, 404)
	if strings.Contains(assertStatus(t, app, "GET", "/api/v1/home", nil, "", 200), "Paid conference") {
		t.Fatal("scheduled event visible")
	}
	req("PATCH", "/admin/events/evt-batch-qa", map[string]any{"publishedAt": "2026-08-01T10:00+03:00"}, staff, 200)
	setup := req("GET", "/events/evt-batch-qa/registration", nil, member, 200)["setup"].(map[string]any)
	if setup["price"] != float64(500) || setup["mode"] != "link" {
		t.Fatal("paid event was published without its access settings")
	}
	mine := req("POST", "/events/evt-batch-qa/register", map[string]any{"answers": map[string]string{}}, member, 200)["mine"].(map[string]any)
	if ticket, _ := mine["ticket"].(string); ticket != "" {
		t.Fatal("external form bypassed paid ticket")
	}
	_, e = db.Exec(ctx, `INSERT INTO giving_transactions(id,category,method,phone,amount,status,item_id,user_id)VALUES('event-batch-payment','Event','bank','0700000000',500,'awaiting_verification','evt-batch-qa',$1)`, memberID)
	if e != nil {
		t.Fatal(e)
	}
	if ticket, _ := req("GET", "/events/evt-batch-qa/registration", nil, member, 200)["mine"].(map[string]any)["ticket"].(string); ticket != "" {
		t.Fatal("pending payment unlocked ticket")
	}
	_, _ = db.Exec(ctx, `UPDATE giving_transactions SET status='success' WHERE id='event-batch-payment'`)
	if req("GET", "/events/evt-batch-qa/registration", nil, member, 200)["mine"].(map[string]any)["ticket"] == "" {
		t.Fatal("paid ticket absent")
	}

	const uploadID = "90bfa424-8872-41d1-90d3-7677cf822a90"
	var pdfBuffer bytes.Buffer
	pdfDocument := fpdf.New("P", "mm", "A4", "")
	pdfDocument.AddPage()
	pdfDocument.SetFont("Helvetica", "", 16)
	pdfDocument.Text(20, 30, "private book fixture")
	if e = pdfDocument.Output(&pdfBuffer); e != nil {
		t.Fatal(e)
	}
	pdf := pdfBuffer.Bytes()
	body := map[string]any{"id": uploadID, "kind": "book", "fileName": "backlog.pdf", "sizeBytes": len(pdf)}
	req("POST", "/uploads", body, member, 403)
	req("POST", "/uploads", body, staff, 200)
	req("PATCH", "/admin/members/"+memberID+"/permissions", map[string]any{"permissions": []string{"books:publish"}}, admin, 200)
	req("GET", "/uploads/"+uploadID, nil, member, 404)
	chunk := func(start int, part []byte, status int) {
		r := httptest.NewRequest("PATCH", "/api/v1/uploads/"+uploadID, bytes.NewReader(part))
		r.Header.Set("Authorization", "Bearer "+staff)
		r.Header.Set("Upload-Offset", strconv.Itoa(start))
		w := httptest.NewRecorder()
		app.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("chunk %d: %d %s", start, w.Code, w.Body.String())
		}
	}
	chunk(0, pdf[:12], 200)
	chunk(0, pdf[:12], 409)
	// Recreate the API to prove offset recovery is not held in process memory.
	app = server.New(cfg, db)
	if req("GET", "/uploads/"+uploadID, nil, staff, 200)["offset"] != float64(12) {
		t.Fatal("offset lost on restart")
	}
	chunk(12, pdf[12:], 200)
	req("POST", "/uploads/"+uploadID+"/finish", nil, staff, 200)
	req("POST", "/uploads/"+uploadID+"/finish", nil, staff, 200)
	publishBook := func() map[string]any {
		var b bytes.Buffer
		form := multipart.NewWriter(&b)
		for k, v := range map[string]string{"uploadedFile": uploadID, "title": "Private batch book", "author": "Ministry", "price": "250", "publishedAt": "2099-01-01T07:00:00Z", "notifyOnPublish": "false"} {
			_ = form.WriteField(k, v)
		}
		_ = form.Close()
		r := httptest.NewRequest("POST", "/api/v1/library", &b)
		r.Header.Set("Authorization", "Bearer "+staff)
		r.Header.Set("Content-Type", form.FormDataContentType())
		w := httptest.NewRecorder()
		app.ServeHTTP(w, r)
		if w.Code != 201 && w.Code != 200 {
			t.Fatalf("book: %d %s", w.Code, w.Body.String())
		}
		return object(w.Body.String())
	}
	book := publishBook()["item"].(map[string]any)
	if !strings.Contains(book["coverUrl"].(string), "/books/covers/") {
		t.Fatal("first-page cover missing")
	}
	if book["encrypted"] != true {
		t.Fatal("protected book status missing")
	}
	publishBook()
	id := book["id"].(string)
	_ = db.QueryRow(ctx, `SELECT count(*)FROM library_items WHERE id=$1`, id).Scan(&count)
	if count != 1 {
		t.Fatal("retry duplicated book")
	}
	req("GET", "/library/"+id+"/file", nil, member, 404)
	if len(stored) != 2 {
		t.Fatalf("duplicate storage objects %d", len(stored))
	}
	for _, b := range stored {
		if bytes.Contains(b, []byte("private book fixture")) {
			t.Fatal("book stored in plaintext")
		}
	}
	req("PATCH", "/library/"+id, map[string]any{"publishedAt": "2026-08-01T07:00:00Z"}, staff, 200)
	req("GET", "/library/"+id+"/file", nil, member, 402)
	customCover := "https://media.example.invalid/uploads/custom-cover.png"
	req("PATCH", "/library/"+id, map[string]any{"coverUrl": customCover}, member, 403)
	req("PATCH", "/library/"+id, map[string]any{"coverUrl": customCover}, staff, 200)
	req("PATCH", "/library/"+id, map[string]any{"description": "An edited material"}, staff, 200)
	var actualCover string
	_ = db.QueryRow(ctx, `SELECT cover_url FROM library_items WHERE id=$1`, id).Scan(&actualCover)
	if actualCover != customCover {
		t.Fatal("metadata edit replaced supplied cover")
	}
	req("PATCH", "/library/"+id, map[string]any{"coverUrl": "https://media.example.invalid/books/files/private.bin"}, staff, 400)
	req("PATCH", "/admin/members/"+staffID+"/permissions", map[string]any{"permissions": []string{}}, admin, 200)
	req("GET", "/uploads/"+uploadID, nil, staff, 404)
	req("GET", "/admin/events", nil, staff, 403)

	req("PATCH", "/admin/members/"+memberID+"/permissions", map[string]any{"permissions": []string{"finance:manage"}}, admin, 200)
	req("GET", "/admin/giving/transactions", nil, member, 200)
	req("PUT", "/admin/giving/details", map[string]string{}, member, 403)
	req("GET", "/admin/members", nil, member, 403)
	assertStatus(t, app, "GET", "/api/v1/admin/giving/transactions/event-batch-payment/receipt.pdf", nil, member, 200)
	req("PATCH", "/admin/members/"+staffID+"/permissions", map[string]any{"permissions": []string{"sermons:manage"}}, admin, 200)
	const mediaID = "90bfa424-8872-41d1-90d3-7677cf822a91"
	mp4 := []byte("0000ftypisom-video-fixture")
	req("POST", "/uploads", map[string]any{"id": mediaID, "kind": "video", "fileName": "service.mp4", "sizeBytes": len(mp4)}, staff, 200)
	r := httptest.NewRequest("PATCH", "/api/v1/uploads/"+mediaID, bytes.NewReader(mp4))
	r.Header.Set("Authorization", "Bearer "+staff)
	r.Header.Set("Upload-Offset", "0")
	w := httptest.NewRecorder()
	app.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("media chunk: %d %s", w.Code, w.Body.String())
	}
	finished := req("POST", "/uploads/"+mediaID+"/finish", nil, staff, 200)
	if !strings.HasPrefix(finished["publicUrl"].(string), "https://media.example.invalid/uploads/") {
		t.Fatal("media location missing")
	}
	req("POST", "/uploads/"+mediaID+"/finish", nil, staff, 200)
	if len(stored) != 3 {
		t.Fatalf("retry duplicated media objects: %d", len(stored))
	}

	_, e = db.Exec(ctx, `WITH live AS(INSERT INTO live_sessions(id,title,broadcaster_id,stream_key,status,price,started_at,ended_at)VALUES('live-catalogue-qa','Replay catalogue',$1,'fixture','ended',900,NOW(),NOW())RETURNING id)INSERT INTO live_archives(session_id,status)SELECT id,'pending'FROM live`, staffID)
	if e != nil {
		t.Fatal(e)
	}
	h := req("GET", "/home", nil, "", 200)
	found := false
	for _, s := range h["sermons"].([]any) {
		item := s.(map[string]any)
		if item["replayId"] == "live-catalogue-qa" {
			found = true
			if item["status"] != "pending" || item["price"] != float64(900) {
				t.Fatal("replay lost status or price")
			}
		}
	}
	if !found {
		t.Fatal("preparing replay missing from Sermons")
	}
}
