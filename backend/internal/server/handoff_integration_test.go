package server_test

import (
	"bytes"
	"compress/zlib"
	"context"
	"encoding/json"
	"fmt"
	"github.com/ariga/shekinah-backend/internal/notifications"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Uses a disposable database and an SMTP sink on loopback; no messages leave
// the machine and no existing member records are changed.
func TestHandoffAttendanceServePlansBranchesAndReset(t *testing.T) {
	baseURL := os.Getenv("TEST_DATABASE_URL")
	if baseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	db, err := pgxpool.New(ctx, createTempDatabase(t, ctx, baseURL))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.RunMigrations(ctx, db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	mailbox := localMailSink(t)
	gin.SetMode(gin.TestMode)
	app := server.New(config.Config{AppEnv: "test", JWTSecret: "handoff-test-secret"}, db)
	requestFor := func(t *testing.T) func(string, string, any, string, int) string {
		return func(method, path string, body any, token string, status int) string {
			t.Helper()
			return assertStatus(t, app, method, "/api/v1"+path, body, token, status)
		}
	}
	request := requestFor(t)
	object := func(body string) map[string]any {
		t.Helper()
		var result map[string]any
		if err := json.Unmarshal([]byte(body), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	login := object(request("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200))
	changed := object(request("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "HandoffAdmin123!"}, login["token"].(string), 200))
	admin := changed["token"].(string)
	request("GET", "/auth/me", nil, login["token"].(string), 401)
	const memberEmail = "handoff.member.with.a.long.email@example.invalid"
	const memberPassword = "HandoffMember123!"
	registered := object(request("POST", "/auth/register", map[string]string{"name": "Handoff Member", "email": memberEmail, "password": memberPassword}, "", 201))
	member := registered["token"].(string)
	memberID := registered["user"].(map[string]any)["id"].(string)
	t.Run("payments cannot be read or settled by strangers", func(t *testing.T) {
		request := requestFor(t)
		payload := map[string]any{"method": "mpesa_paybill", "category": "Offering", "amount": 100, "reference": "SECUREAUDIT001", "phone": "0700000000"}
		transaction := object(request("POST", "/giving/confirm", payload, member, 201))["transaction"].(map[string]any)
		id := transaction["id"].(string)
		request("GET", "/giving/transactions/"+id, nil, "", 401)
		request("GET", "/giving/transactions/"+id+"/invoice.pdf", nil, "", 401)
		request("GET", "/giving/transactions/"+id, nil, member, 200)
		request("GET", "/giving/transactions/"+id, nil, admin, 200)
		other := object(request("POST", "/auth/register", map[string]string{"name": "Other Member", "email": "other@example.invalid", "password": "OtherPassword123!"}, "", 201))["token"].(string)
		request("GET", "/giving/transactions/"+id, nil, other, 403)
		request("GET", "/giving/card/mock-complete/"+id, nil, "", 404)
		request("GET", "/giving/card/return?tx_ref="+id+"&status=successful&transaction_id=123", nil, "", 503)
		var status string
		if err := db.QueryRow(ctx, "SELECT status FROM giving_transactions WHERE id=$1", id).Scan(&status); err != nil {
			t.Fatal(err)
		}
		if status != "awaiting_verification" {
			t.Fatalf("untrusted request changed payment to %s", status)
		}
		payload["reference"] = "GUESTSECURE001"
		guest := object(request("POST", "/giving/confirm", payload, "", 201))["transaction"].(map[string]any)
		guestID := guest["id"].(string)
		capability, ok := guest["receiptToken"].(string)
		if !ok || capability == "" {
			t.Fatal("guest confirmation lacks receipt capability")
		}
		request("GET", "/giving/transactions/"+guestID, nil, "", 401)
		req := httptest.NewRequest("GET", "/api/v1/giving/transactions/"+guestID, nil)
		req.Header.Set("X-Receipt-Token", capability)
		rec := httptest.NewRecorder()
		app.ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("guest capability rejected: %d", rec.Code)
		}
		if _, err := db.Exec(ctx, `INSERT INTO giving_transactions (id,method,provider,amount,currency,status,user_id,category,phone) VALUES ('audit-card','card','flutterwave',100,'KES','pending',$1,'Offering','0700000000')`, memberID); err != nil {
			t.Fatal(err)
		}
		amount, currency, reference := 50, "KES", "audit-card"
		provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer test-key" {
				t.Error("provider verification not authenticated")
			}
			fmt.Fprintf(w, `{"status":"success","data":{"tx_ref":%q,"status":"successful","currency":%q,"amount":%d}}`, reference, currency, amount)
		}))
		defer provider.Close()
		t.Setenv("FLUTTERWAVE_SECRET_KEY", "test-key")
		t.Setenv("FLUTTERWAVE_BASE_URL", provider.URL)
		verify := "/giving/card/return?tx_ref=audit-card&transaction_id=123"
		request("GET", verify, nil, "", 409)
		amount, currency = 100, "USD"
		request("GET", verify, nil, "", 409)
		currency, reference = "KES", "wrong-reference"
		request("GET", verify, nil, "", 409)
		reference = "audit-card"
		request("GET", verify, nil, "", 200)
		request("GET", verify, nil, "", 200)

	})

	t.Run("M-Pesa callback validates capability amount phone and idempotence", func(t *testing.T) {
		request := requestFor(t)
		t.Setenv("MPESA_CALLBACK_TOKEN", "callback-capability-fixture")
		_, err := db.Exec(ctx, `INSERT INTO giving_transactions(id,category,method,phone,amount,status,checkout_request_id,merchant_request_id,user_id)VALUES('stk-qa','Offering','mpesa','254700000000',500,'pending','checkout-qa','merchant-qa',$1)`, memberID)
		if err != nil {
			t.Fatal(err)
		}
		payload := func(amount int) map[string]any {
			return map[string]any{"Body": map[string]any{"stkCallback": map[string]any{"CheckoutRequestID": "checkout-qa", "MerchantRequestID": "merchant-qa", "ResultCode": 0, "ResultDesc": "Success", "CallbackMetadata": map[string]any{"Item": []any{map[string]any{"Name": "Amount", "Value": amount}, map[string]any{"Name": "PhoneNumber", "Value": 254700000000}, map[string]any{"Name": "MpesaReceiptNumber", "Value": "QA12345678"}}}}}}
		}
		request("POST", "/giving/mpesa/callback", payload(500), "", 403)
		request("POST", "/giving/mpesa/callback?token=callback-capability-fixture", payload(499), "", 409)
		request("POST", "/giving/mpesa/callback?token=callback-capability-fixture", payload(500), "", 200)
		request("POST", "/giving/mpesa/callback?token=callback-capability-fixture", payload(500), "", 200)
		var status, receipt string
		_ = db.QueryRow(ctx, `SELECT status,mpesa_receipt_number FROM giving_transactions WHERE id='stk-qa'`).Scan(&status, &receipt)
		if status != "success" || receipt != "QA12345678" {
			t.Fatal("verified callback did not settle correctly")
		}
	})
	t.Run("scheduled books stay private and plaintext cannot become paid", func(t *testing.T) {
		request := requestFor(t)
		_, err := db.Exec(ctx, `INSERT INTO library_items(id,title,description,author,category,file_url,file_type,price,published_at)VALUES('book-future-qa','Scheduled QA','QA','QA','QA','https://example.invalid/file.pdf','pdf',0,NOW()+INTERVAL '1 day')`)
		if err != nil {
			t.Fatal(err)
		}
		request("GET", "/library/book-future-qa/file", nil, "", 404)
		request("PATCH", "/library/book-future-qa", map[string]int{"price": 50}, admin, 400)
	})

	t.Run("community cursor history removals and reports", func(t *testing.T) {
		request := requestFor(t)
		_, err := db.Exec(ctx, `INSERT INTO community_messages(id,user_id,channel,display_name,message,status,created_at) SELECT 'history-'||lpad(n::text,3,'0'),$1,'global','QA','Message '||n,'approved',NOW()+INTERVAL '1 minute' FROM generate_series(1,165)n`, memberID)
		if err != nil {
			t.Fatal(err)
		}
		first := object(request("GET", "/community/messages?channel=global", nil, "", 200))["messages"].([]any)
		if len(first) != 80 || first[0].(map[string]any)["id"] != "history-165" {
			t.Fatalf("wrong latest page: %v", first[0])
		}
		last := first[len(first)-1].(map[string]any)["id"].(string)
		second := object(request("GET", "/community/messages?before="+last, nil, "", 200))["messages"].([]any)
		if len(second) != 80 || second[0].(map[string]any)["id"] != "history-085" {
			t.Fatal("cursor lost messages with equal timestamps")
		}
		request("POST", "/community/messages/history-165/report", map[string]string{"reason": "Needs ministry review"}, "", 401)
		request("POST", "/community/messages/history-165/report", map[string]string{"reason": "Needs ministry review"}, member, 200)
		request("POST", "/community/messages/history-165/report", map[string]string{"reason": "Needs ministry review"}, member, 200)
		reports := object(request("GET", "/admin/community/reports", nil, admin, 200))["reports"].([]any)
		if len(reports) != 1 {
			t.Fatal("report duplicates were not prevented")
		}
		request("PATCH", "/admin/community/messages/history-165", map[string]string{"status": "hidden"}, member, 403)
		request("PATCH", "/admin/community/messages/history-165", map[string]string{"status": "hidden"}, admin, 200)
		removed := object(request("GET", "/community/messages?known=history-165,history-164", nil, "", 200))["removed"].([]any)
		if len(removed) != 1 || removed[0] != "history-165" {
			t.Fatal("hidden message was not reconciled")
		}
		after := object(request("GET", "/community/messages?after=history-163&order=asc", nil, "", 200))["messages"].([]any)
		if len(after) != 1 || after[0].(map[string]any)["id"] != "history-164" {
			t.Fatal("incremental cursor missed equal timestamp")
		}
	})
	t.Run("paid replays retain entitlement and protect ranges", func(t *testing.T) {
		request := requestFor(t)
		dir := t.TempDir()
		t.Setenv("LIVE_RECORDINGS_DIR", dir)
		if err := os.MkdirAll(filepath.Join(dir, "cache"), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "cache", "live-replay-qa.mp4"), []byte("0123456789recording"), 0600); err != nil {
			t.Fatal(err)
		}
		_, err := db.Exec(ctx, `WITH created AS (INSERT INTO live_sessions(id,title,broadcaster_id,stream_key,status,price,started_at,ended_at)VALUES('live-replay-qa','Paid replay',$1,'fixture','ended',500,NOW()-INTERVAL '1 hour',NOW()) RETURNING id) INSERT INTO live_archives(session_id,status,object_key,size_bytes)SELECT id,'ready','encrypted-object',19 FROM created`, memberID)
		if err != nil {
			t.Fatal(err)
		}
		request("GET", "/live/replays/live-replay-qa/file", nil, "", 402)
		request("GET", "/live/replays/live-replay-qa/file", nil, member, 402)
		_, err = db.Exec(ctx, `INSERT INTO giving_transactions(id,category,method,phone,amount,status,item_id,user_id)VALUES('replay-access','Live','bank','0700000000',500,'success','live-replay-qa',$1)`, memberID)
		if err != nil {
			t.Fatal(err)
		}
		if got := request("GET", "/live/replays/live-replay-qa/file", nil, member, 200); got != "0123456789recording" {
			t.Fatal("replay bytes changed")
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v1/live/replays/live-replay-qa/file", nil)
		req.Header.Set("Authorization", "Bearer "+member)
		req.Header.Set("Range", "bytes=3-6")
		app.ServeHTTP(rr, req)
		if rr.Code != 206 || rr.Body.String() != "3456" {
			t.Fatalf("range playback failed: %d %s", rr.Code, rr.Body.String())
		}
	})
	t.Run("publication queues new content once without replaying old news", func(t *testing.T) {
		_, err := db.Exec(ctx, `INSERT INTO updates(id,title,excerpt,update_date,image_url)VALUES('publication-qa','QA update','Message',CURRENT_DATE,'')`)
		if err != nil {
			t.Fatal(err)
		}
		publisher := notifications.NewHandler(db)
		if err = publisher.PublishNext(ctx); err != nil {
			t.Fatal(err)
		}
		var count int
		_ = db.QueryRow(ctx, `SELECT count(*)FROM notification_messages WHERE title='QA update'`).Scan(&count)
		if count != 1 {
			t.Fatalf("new publication count %d", count)
		}
		_, _ = db.Exec(ctx, `UPDATE updates SET title='QA update edited' WHERE id='publication-qa'`)
		if err = publisher.PublishNext(ctx); err != nil {
			t.Fatal(err)
		}
		_ = db.QueryRow(ctx, `SELECT count(*)FROM notification_messages WHERE title LIKE 'QA update%'`).Scan(&count)
		if count != 1 {
			t.Fatal("editing resent notification")
		}
	})
	t.Run("official details require admin and real links", func(t *testing.T) {
		request := requestFor(t)
		request("PUT", "/admin/settings/ministry", map[string]string{"website": "https://example.com"}, member, 403)
		request("PUT", "/admin/settings/ministry", map[string]string{"website": "https://example.com"}, admin, 400)
		request("PUT", "/admin/settings/ministry", map[string]string{"email": "ministry@example.invalid", "website": ""}, admin, 200)
		request("GET", "/settings/ministry", nil, "", 200)
	})

	t.Run("attendance permission duplicate expiry and PDF", func(t *testing.T) {
		request := requestFor(t)
		code := object(request("GET", "/checkin/code", nil, member, 200))["code"].(string)
		payload := map[string]string{"code": code, "occasion": "Handoff Service"}
		request("POST", "/attendance/scan", payload, "", 401)
		request("POST", "/attendance/scan", payload, member, 403)
		first := object(request("POST", "/attendance/scan", payload, admin, 200))
		if first["already"] != false || first["count"] != float64(1) || first["name"] != "Handoff Member" {
			t.Fatalf("unexpected check-in: %v", first)
		}
		second := object(request("POST", "/attendance/scan", payload, admin, 200))
		if second["already"] != true || second["count"] != float64(1) {
			t.Fatalf("duplicate changed attendance: %v", second)
		}
		request("GET", "/attendance", nil, member, 403)
		rows := object(request("GET", "/attendance?occasion=Handoff%20Service", nil, admin, 200))["records"].([]any)
		if len(rows) != 1 || rows[0].(map[string]any)["email"] != memberEmail {
			t.Fatalf("wrong attendance records: %v", rows)
		}
		pdf := request("GET", "/attendance/report.pdf?occasion=Handoff%20Service", nil, admin, 200)
		if !strings.HasPrefix(pdf, "%PDF-") || !strings.Contains(pdf, "%%EOF") {
			t.Fatal("report is not a complete PDF")
		}
		if !strings.Contains(pdfContent(t, pdf), memberEmail) {
			t.Fatalf("attendance PDF lost member email; extracted text: %q", pdfContent(t, pdf))
		}
		if _, err := db.Exec(ctx, "UPDATE member_checkin_codes SET updated_at = NOW() - INTERVAL '31 minutes' WHERE user_id = $1", memberID); err != nil {
			t.Fatal(err)
		}
		request("POST", "/attendance/scan", payload, admin, 404)
		request("POST", "/attendance/scan", map[string]string{"code": "BAD-CODE"}, admin, 404)
		request("POST", "/attendance/scan", map[string]string{"code": "SSG-EVENT:bad"}, admin, 400)
	})

	t.Run("multi page attendance preserves every email", func(t *testing.T) {
		request := requestFor(t)
		_, err := db.Exec(ctx, `WITH members AS (
			INSERT INTO users (name, email, password_hash)
			SELECT 'Attendee ' || n, 'attendee.' || n || '.with.a.long.email@example.invalid', 'unused-test-hash'
			FROM generate_series(1, 60) n RETURNING id
		) INSERT INTO attendance (id, user_id, occasion, occasion_date, method)
		SELECT 'att-test-' || id, id, 'Large Service',
		(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')::date, 'qr' FROM members`)
		if err != nil {
			t.Fatal(err)
		}
		pdf := request("GET", "/attendance/report.pdf?occasion=Large%20Service", nil, admin, 200)
		if len(regexp.MustCompile(`/Type /Page\b`).FindAllString(pdf, -1)) < 2 {
			t.Fatal("large attendance did not produce multiple pages")
		}
		text := pdfContent(t, pdf)
		for n := 1; n <= 60; n++ {
			email := "attendee." + strconv.Itoa(n) + ".with.a.long.email@example.invalid"
			if !strings.Contains(text, email) {
				t.Fatalf("PDF lost %s", email)
			}
		}
	})

	t.Run("serve request reaches leader and duplicate is refused", func(t *testing.T) {
		request := requestFor(t)
		team := map[string]any{"name": "Handoff Team", "leaderName": "QA Leader", "leaderEmail": "leader@example.invalid", "isActive": true}
		request("PUT", "/admin/serve/teams/new", team, member, 403)
		teamID := object(request("PUT", "/admin/serve/teams/new", team, admin, 200))["id"].(string)
		payload := map[string]string{"teamId": teamID, "phone": "0700000000", "availability": "Sundays", "message": "I can help with sound."}
		request("POST", "/serve/requests", payload, "", 401)
		request("POST", "/serve/requests", map[string]string{"teamId": teamID}, member, 400)
		requestID := object(request("POST", "/serve/requests", payload, member, 201))["id"].(string)
		message := receiveMail(t, mailbox)
		for _, want := range []string{"To: leader@example.invalid", "Reply-To: " + memberEmail, "I can help with sound.", "Handoff Team", "text/html"} {
			if !strings.Contains(message, want) {
				t.Fatalf("serve email missing %q", want)
			}
		}
		request("POST", "/serve/requests", payload, member, 409)
		request("PATCH", "/admin/serve/requests/"+requestID, map[string]string{"status": "placed"}, admin, 200)
		listed := object(request("GET", "/serve/teams", nil, member, 200))
		if listed["mine"].(map[string]any)[teamID] != "placed" {
			t.Fatal("member did not see updated request status")
		}
		for _, value := range listed["teams"].([]any) {
			row := value.(map[string]any)
			if _, leaked := row["leaderEmail"]; leaked {
				t.Fatal("leader email exposed publicly")
			}
		}
	})

	t.Run("reading progress notes reminders restart and isolation", func(t *testing.T) {
		request := requestFor(t)
		plans := object(request("GET", "/reading-plans", nil, "", 200))["plans"].([]any)
		if len(plans) < 7 {
			t.Fatalf("expected seven plans, got %d", len(plans))
		}
		planID := plans[0].(map[string]any)["id"].(string)
		path := "/reading-plans/" + planID
		request("POST", path+"/start", nil, "", 401)
		request("POST", path+"/start", map[string]bool{}, member, 200)
		request("POST", path+"/days/1/complete", nil, member, 200)
		request("POST", path+"/days/1/complete", nil, member, 200)
		request("POST", path+"/days/999/complete", nil, member, 404)
		request("PUT", path+"/days/1/note", map[string]string{"note": "A private reflection"}, member, 200)
		request("PATCH", path+"/reminder", map[string]any{"enabled": true, "reminderTime": "07:30"}, member, 200)
		request("PATCH", path+"/reminder", map[string]any{"enabled": true, "reminderTime": "25:70"}, member, 400)
		plan := object(request("GET", path+"/mine", nil, member, 200))["plan"].(map[string]any)
		if plan["completedDays"] != float64(1) || plan["todayDay"] != float64(1) || plan["reminderTime"] != "07:30" {
			t.Fatalf("wrong saved plan: %v", plan)
		}
		if !strings.Contains(request("GET", path+"/mine", nil, member, 200), "A private reflection") {
			t.Fatal("note was lost")
		}
		if strings.Contains(request("GET", path+"/mine", nil, admin, 200), "A private reflection") {
			t.Fatal("another member can read private notes")
		}
		request("DELETE", path+"/days/1/complete", nil, member, 200)
		plan = object(request("GET", path+"/mine", nil, member, 200))["plan"].(map[string]any)
		if plan["completedDays"] != float64(0) {
			t.Fatal("undo did not clear the completed day")
		}
		request("POST", path+"/days/1/complete", nil, member, 200)
		request("POST", path+"/start", map[string]bool{"restart": true}, member, 200)
		plan = object(request("GET", path+"/mine", nil, member, 200))["plan"].(map[string]any)
		if plan["completedDays"] != float64(0) {
			t.Fatal("restart did not clear progress")
		}
		request("DELETE", path+"/start", nil, member, 200)
		plan = object(request("GET", path+"/mine", nil, member, 200))["plan"].(map[string]any)
		if _, enrolled := plan["startedOn"]; enrolled {
			t.Fatal("leave kept enrollment")
		}
		if !strings.Contains(request("GET", path+"/mine", nil, member, 200), "A private reflection") {
			t.Fatal("leaving the plan deleted private notes")
		}
	})

	t.Run("admin branches reach member home", func(t *testing.T) {
		request := requestFor(t)
		body := map[string]any{"name": "Handoff Branch", "address": "QA Road", "services": "Sunday 9 AM", "phone": "0700000000", "latitude": -1.29, "longitude": 36.82}
		request("POST", "/admin/branches", body, member, 403)
		branch := object(request("POST", "/admin/branches", body, admin, 201))["branch"].(map[string]any)
		id := branch["id"].(string)
		if !strings.Contains(request("GET", "/home", nil, "", 200), "Handoff Branch") {
			t.Fatal("created branch missing from home")
		}
		request("PATCH", "/admin/branches/"+id, map[string]string{"name": "Renamed Handoff Branch"}, admin, 200)
		if !strings.Contains(request("GET", "/home", nil, "", 200), "Renamed Handoff Branch") {
			t.Fatal("branch update missing from home")
		}
		request("DELETE", "/admin/branches/"+id, nil, admin, 204)
		if strings.Contains(request("GET", "/home", nil, "", 200), "Renamed Handoff Branch") {
			t.Fatal("deleted branch remains on home")
		}
	})

	t.Run("member and admin password reset email and one time code", func(t *testing.T) {
		request := requestFor(t)
		reset := func(email, oldPassword, newPassword string) string {
			t.Helper()
			request("POST", "/auth/password-reset/request", map[string]string{"email": email}, "", 200)
			message := receiveMail(t, mailbox)
			match := regexp.MustCompile(`(?m)^\s{4}(\d{6})\s*$`).FindStringSubmatch(message)
			if len(match) != 2 || !strings.Contains(message, "To: "+email) {
				t.Fatal("reset email missing recipient or code")
			}
			payload := map[string]string{"email": email, "code": "BAD123", "newPassword": newPassword}
			request("POST", "/auth/password-reset/confirm", payload, "", 400)
			payload["code"] = match[1]
			request("POST", "/auth/password-reset/confirm", payload, "", 200)
			request("POST", "/auth/password-reset/confirm", payload, "", 400)
			request("POST", "/auth/login", map[string]string{"email": email, "password": oldPassword}, "", 401)
			return object(request("POST", "/auth/login", map[string]string{"email": email, "password": newPassword}, "", 200))["token"].(string)
		}
		reset(memberEmail, memberPassword, "NewMemberPassword123!")
		admin = reset("vincent@example.com", "HandoffAdmin123!", "NewAdminPassword123!")
		request("POST", "/admin/members/"+memberID+"/reset-password", nil, admin, 200)
		if !strings.Contains(receiveMail(t, mailbox), "To: "+memberEmail) {
			t.Fatal("admin reset sent to wrong member")
		}
	})
}

// fpdf compresses page drawing instructions; inspect those streams so the
// report check catches lost text without depending on a system PDF reader.
func pdfContent(t *testing.T, pdf string) string {
	t.Helper()
	var content strings.Builder
	for _, match := range regexp.MustCompile(`(?s)/Length (\d+).*?stream\r?\n`).FindAllStringSubmatchIndex(pdf, -1) {
		length, _ := strconv.Atoi(pdf[match[2]:match[3]])
		start := match[1]
		if start+length > len(pdf) {
			t.Fatal("truncated PDF stream")
		}
		reader, err := zlib.NewReader(bytes.NewBufferString(pdf[start : start+length]))
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(reader)
		_ = reader.Close()
		if err != nil {
			t.Fatal(err)
		}
		for _, text := range regexp.MustCompile(`\(((?:\\.|[^\\)])*)\)\s*Tj`).FindAllSubmatch(data, -1) {
			content.Write(text[1])
		}
	}
	return content.String()
}

func receiveMail(t *testing.T, mailbox <-chan string) string {
	t.Helper()
	select {
	case message := <-mailbox:
		return message
	case <-time.After(5 * time.Second):
		t.Fatal("email did not reach local SMTP sink")
		return ""
	}
}

func localMailSink(t *testing.T) <-chan string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	host, port, _ := net.SplitHostPort(listener.Addr().String())
	for k, v := range map[string]string{"SMTP_HOST": host, "SMTP_PORT": port, "SMTP_FROM": "Shekinah <no-reply@example.invalid>", "SMTP_USERNAME": "", "SMTP_PASSWORD": ""} {
		t.Setenv(k, v)
	}
	messages := make(chan string, 10)
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				defer conn.Close()
				_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
				client := textproto.NewConn(conn)
				_ = client.PrintfLine("220 localhost test mail sink")
				for {
					line, err := client.ReadLine()
					if err != nil {
						return
					}
					switch {
					case strings.HasPrefix(line, "DATA"):
						_ = client.PrintfLine("354 send message")
						body, err := client.ReadDotBytes()
						if err != nil {
							return
						}
						messages <- string(body)
						_ = client.PrintfLine("250 accepted")
					case strings.HasPrefix(line, "QUIT"):
						_ = client.PrintfLine("221 goodbye")
						return
					default:
						_ = client.PrintfLine("250 localhost")
					}
				}
			}()
		}
	}()
	return messages
}
