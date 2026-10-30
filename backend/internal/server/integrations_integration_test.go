package server_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/integrations"
	"github.com/ariga/shekinah-backend/internal/server"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type providerTransport func(*http.Request) (*http.Response, error)

func (f providerTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// A disposable database and a mocked HTTP transport: no provider requests,
// payment prompts, uploads, emails or device notifications leave the test.
func TestProtectedOperationalIntegrationsAndPaymentCallbacks(t *testing.T) {
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
	if database.CheckProductionAccounts(ctx, db) == nil {
		t.Fatal("demonstration accounts passed production safety gate")
	}
	gin.SetMode(gin.TestMode)
	pushes, checks, cards := 0, 0, 0
	dropNext := false
	var earlyCallback func(string, int)
	expectedPartyB := "174379"
	expectedMerchantType := "CustomerPayBillOnline"
	callbacks := []string{}
	expectedSecret := "secret-consumer-fixture"
	cardID := ""
	cardVerifiedAmount := 250
	client := &http.Client{Transport: providerTransport(func(r *http.Request) (*http.Response, error) {
		response := func(body string) (*http.Response, error) {
			return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body))}, nil
		}
		switch {
		case r.URL.Path == "/oauth/v1/generate":
			key, secret, ok := r.BasicAuth()
			if !ok || key != "consumer-fixture" || secret != expectedSecret {
				t.Fatal("OAuth did not use saved runtime credentials")
			}
			checks++
			return response(`{"access_token":"test-access-token","expires_in":"3600"}`)
		case r.URL.Path == "/mpesa/stkpush/v1/processrequest":
			if r.Header.Get("Authorization") != "Bearer test-access-token" {
				t.Fatal("missing provider authentication")
			}
			var payload map[string]any
			if json.NewDecoder(r.Body).Decode(&payload) != nil {
				t.Fatal("invalid STK payload")
			}
			if payload["Amount"] != float64(250) || payload["PhoneNumber"] != "254700000000" {
				t.Fatal("purchase price or phone was client-controlled", payload["Amount"])
			}
			if payload["PartyB"] != expectedPartyB || payload["TransactionType"] != expectedMerchantType {
				t.Fatal("merchant/till settings not applied")
			}
			if len([]rune(payload["TransactionDesc"].(string))) > 13 || len(payload["AccountReference"].(string)) > 12 {
				t.Fatal("Daraja request exceeds provider field limits")
			}
			callbacks = append(callbacks, payload["CallBackURL"].(string))
			pushes++
			if earlyCallback != nil {
				deliver := earlyCallback
				earlyCallback = nil
				deliver(callbacks[len(callbacks)-1], pushes)
			}
			if dropNext {
				dropNext = false
				return nil, fmt.Errorf("submission response lost")
			}
			return response(fmt.Sprintf(`{"ResponseCode":"0","CheckoutRequestID":"checkout-%d","MerchantRequestID":"merchant-%d"}`, pushes, pushes))
		case r.URL.Path == "/v3/payments":
			if r.Header.Get("Authorization") != "Bearer card-secret-fixture" {
				t.Fatal("card secret not loaded")
			}
			var payload map[string]any
			_ = json.NewDecoder(r.Body).Decode(&payload)
			cardID = payload["tx_ref"].(string)
			cards++
			return response(`{"status":"success","data":{"link":"https://checkout.flutterwave.com/fixture"}}`)
		case strings.HasPrefix(r.URL.Path, "/v3/transactions/"):
			return response(fmt.Sprintf(`{"status":"success","data":{"status":"successful","tx_ref":%q,"amount":%d,"currency":"KES","id":12345}}`, cardID, cardVerifiedAmount))
		default:
			t.Fatalf("unexpected provider request: %s", r.URL.Host+r.URL.Path)
			return nil, fmt.Errorf("unexpected request")
		}
	})}
	cfg := config.Config{AppEnv: "test", JWTSecret: "protected-integrations-test-encryption-root", ProviderHTTPClient: client}
	app := server.New(cfg, db)
	object := func(body string) map[string]any {
		var result map[string]any
		if json.Unmarshal([]byte(body), &result) != nil {
			t.Fatal("invalid JSON response")
		}
		return result
	}
	req := func(method, path string, body any, token string, status int) map[string]any {
		return object(assertStatus(t, app, method, "/api/v1"+path, body, token, status))
	}
	login := req("POST", "/auth/login", map[string]string{"email": "vincent@example.com", "password": "password123"}, "", 200)
	admin := req("PATCH", "/auth/password", map[string]string{"currentPassword": "password123", "newPassword": "ProviderAdmin123!"}, login["token"].(string), 200)["token"].(string)
	reg := req("POST", "/auth/register", map[string]string{"name": "Provider Member", "email": "provider.member@example.invalid", "password": "ProviderMember123!"}, "", 201)
	member := reg["token"].(string)
	req("GET", "/admin/settings/integrations", nil, "", 401)
	req("GET", "/admin/settings/integrations", nil, member, 403)
	req("PUT", "/admin/settings/integrations/mpesa", map[string]any{}, member, 403)
	settings := map[string]any{"enabled": true, "values": map[string]string{"MPESA_ENV": "sandbox", "MPESA_CONSUMER_KEY": "consumer-fixture", "MPESA_CONSUMER_SECRET": expectedSecret, "MPESA_SHORTCODE": "174379", "MPESA_PASSKEY": "passkey-fixture", "MPESA_CALLBACK_URL": "https://api.ministry.invalid/api/v1/giving/mpesa/callback"}}
	view := req("PUT", "/admin/settings/integrations/mpesa", settings, admin, 200)["integration"].(map[string]any)
	if view["configured"].(map[string]any)["MPESA_CALLBACK_TOKEN"] != true {
		t.Fatal("callback token was not generated")
	}
	raw := assertStatus(t, app, "GET", "/api/v1/admin/settings/integrations", nil, admin, 200)
	for _, secret := range []string{expectedSecret, "passkey-fixture", "consumer-fixture"} {
		if strings.Contains(raw, secret) {
			t.Fatal("credential leaked to browser")
		}
	}
	var stored string
	if err = db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key='integration_v1_mpesa'`).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(stored, expectedSecret) || strings.Contains(stored, "174379") {
		t.Fatal("provider settings stored as plaintext")
	}
	store := integrations.Store{DB: db, Secret: cfg.JWTSecret}
	before, _, err := store.Load(ctx, "mpesa")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = (integrations.Store{DB: db, Secret: "wrong-root"}).Load(ctx, "mpesa"); err == nil {
		t.Fatal("wrong root decrypted credentials")
	}
	req("PUT", "/admin/settings/integrations/mpesa", map[string]any{"enabled": true, "values": map[string]string{"MPESA_CONSUMER_SECRET": "", "MPESA_ACCOUNT_REFERENCE": "Ministry"}}, admin, 200)
	after, _, err := store.Load(ctx, "mpesa")
	if err != nil || after.Values["MPESA_CONSUMER_SECRET"] != expectedSecret || after.Values["MPESA_CALLBACK_TOKEN"] != before.Values["MPESA_CALLBACK_TOKEN"] {
		t.Fatal("blank save replaced credentials")
	}
	req("PUT", "/admin/settings/integrations/mpesa", map[string]any{"enabled": true, "values": map[string]string{"MPESA_BASE_URL": "https://attacker.invalid"}}, admin, 400)
	req("POST", "/admin/settings/integrations/mpesa/check", map[string]any{}, admin, 200)
	if pushes != 0 || checks != 1 {
		t.Fatal("connection check initiated a charge")
	}
	for _, sql := range []string{`INSERT INTO library_items(id,title,file_key,price)VALUES('book-gateway-fixture','Paid material','encrypted-fixture',250)`, `INSERT INTO library_items(id,title,file_key,price)VALUES('book-gateway-other','Another material','encrypted-other',250)`, `INSERT INTO library_items(id,title,file_key,price)VALUES('book-gateway-lost','Lost response material','encrypted-lost',250)`, `INSERT INTO library_items(id,title,file_key,price)VALUES('book-gateway-early','Early callback material','encrypted-early',250)`} {
		if _, err = db.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	payment := map[string]any{"requestId": "payment-fixture-01", "itemId": "book-gateway-fixture", "amount": 1, "category": "Offering", "phone": "0700000000"}
	paid := req("POST", "/giving/mpesa/stk-push", payment, member, 202)["transaction"].(map[string]any)
	paymentID := paid["id"].(string)
	if paid["amount"] != float64(250) {
		t.Fatal("catalogue price not enforced")
	}
	req("POST", "/giving/mpesa/stk-push", payment, member, 200)
	if pushes != 1 {
		t.Fatal("duplicate request sent another prompt")
	}
	changed := map[string]any{"requestId": "payment-fixture-01", "itemId": "book-gateway-other", "amount": 250, "phone": "0700000000"}
	req("POST", "/giving/mpesa/stk-push", changed, member, 409)
	other := map[string]any{"requestId": "payment-fixture-02", "itemId": "book-gateway-fixture", "amount": 250, "phone": "0700000000"}
	req("POST", "/giving/mpesa/stk-push", other, member, 409)
	callbackURL, err := url.Parse(callbacks[0])
	if err != nil {
		t.Fatal(err)
	}
	originalToken := callbackURL.Query().Get("token")
	if originalToken == "" {
		t.Fatal("callback is unauthenticated")
	}
	req("PUT", "/admin/settings/integrations/mpesa", map[string]any{"enabled": true, "values": map[string]string{"MPESA_CALLBACK_TOKEN": "rotated-callback-token-fixture-0000000"}}, admin, 200)
	payload := func(amount int, merchant string, code int) map[string]any {
		return map[string]any{"Body": map[string]any{"stkCallback": map[string]any{"CheckoutRequestID": "checkout-1", "MerchantRequestID": merchant, "ResultCode": code, "ResultDesc": "Fixture callback", "CallbackMetadata": map[string]any{"Item": []any{map[string]any{"Name": "Amount", "Value": amount}, map[string]any{"Name": "PhoneNumber", "Value": 254700000000}, map[string]any{"Name": "MpesaReceiptNumber", "Value": "FIXTURE12345"}}}}}}
	}
	req("POST", "/giving/mpesa/callback", payload(250, "merchant-1", 0), "", 403)
	req("POST", "/giving/mpesa/callback?token=rotated-callback-token-fixture-0000000", payload(250, "merchant-1", 0), "", 403)
	path := "/giving/mpesa/callback?token=" + url.QueryEscape(originalToken)
	malformed := payload(250, "merchant-1", 0)
	malformed["Body"].(map[string]any)["stkCallback"].(map[string]any)["ResultCode"] = "invalid"
	req("POST", path, malformed, "", 400)
	decimal := payload(250, "merchant-1", 0)
	decimal["Body"].(map[string]any)["stkCallback"].(map[string]any)["CallbackMetadata"].(map[string]any)["Item"].([]any)[0].(map[string]any)["Value"] = 250.9
	req("POST", path, decimal, "", 409)
	req("POST", path, payload(249, "merchant-1", 0), "", 409)
	req("POST", path, payload(250, "wrong-merchant", 1032), "", 409)
	req("POST", path, payload(250, "merchant-1", 0), "", 200)
	req("POST", path, payload(250, "merchant-1", 0), "", 200)
	req("POST", path, payload(250, "merchant-1", 1032), "", 200)
	final := req("GET", "/giving/transactions/"+paymentID, nil, member, 200)["transaction"].(map[string]any)
	if final["status"] != "success" {
		t.Fatal("callback retry downgraded confirmed payment")
	}
	req("POST", "/giving/mpesa/stk-push", other, member, 409)
	req("GET", "/giving/transactions/"+paymentID, nil, "", 401)

	// A lost submission response must not cause a second prompt or lose a later callback.
	dropNext = true
	lostRequest := map[string]any{"requestId": "lost-response-fixture-01", "itemId": "book-gateway-lost", "amount": 1, "phone": "0700000000"}
	lost := req("POST", "/giving/mpesa/stk-push", lostRequest, member, 502)["transaction"].(map[string]any)
	req("POST", "/giving/mpesa/stk-push", lostRequest, member, 200)
	if pushes != 2 {
		t.Fatal("uncertain retry launched another payment prompt")
	}
	lostURL, e := url.Parse(callbacks[1])
	if e != nil {
		t.Fatal(e)
	}
	if lostURL.Query().Get("intent") != lost["id"] {
		t.Fatal("callback omitted protected intent")
	}
	recovered := payload(249, "merchant-2", 0)
	body := recovered["Body"].(map[string]any)["stkCallback"].(map[string]any)
	body["CheckoutRequestID"] = "checkout-2"
	lostPath := strings.TrimPrefix(lostURL.RequestURI(), "/api/v1")
	req("POST", lostPath, recovered, "", 409)
	var checkout string
	if e = db.QueryRow(ctx, `SELECT checkout_request_id FROM giving_transactions WHERE id=$1`, lost["id"]).Scan(&checkout); e != nil || checkout != "" {
		t.Fatal("invalid callback bound the uncertain checkout")
	}
	body["CallbackMetadata"].(map[string]any)["Item"].([]any)[0].(map[string]any)["Value"] = 250
	body["CallbackMetadata"].(map[string]any)["Item"].([]any)[2].(map[string]any)["Value"] = "LOST1234567"
	req("POST", lostPath, recovered, "", 200)
	settled := req("GET", "/giving/transactions/"+lost["id"].(string), nil, member, 200)["transaction"].(map[string]any)
	if settled["status"] != "success" {
		t.Fatal("genuine callback did not recover lost submission response")
	}

	// A fast callback can arrive before the submission acknowledgement is saved.
	expectedPartyB = "123456"
	expectedMerchantType = "CustomerBuyGoodsOnline"
	req("PUT", "/admin/settings/integrations/mpesa", map[string]any{"enabled": true, "values": map[string]string{"MPESA_PARTY_B": expectedPartyB, "MPESA_TRANSACTION_TYPE": expectedMerchantType}}, admin, 200)
	earlyCallback = func(address string, n int) {
		u, e := url.Parse(address)
		if e != nil {
			t.Fatal(e)
		}
		value := payload(250, fmt.Sprintf("merchant-%d", n), 0)
		body := value["Body"].(map[string]any)["stkCallback"].(map[string]any)
		body["CheckoutRequestID"] = fmt.Sprintf("checkout-%d", n)
		body["CallbackMetadata"].(map[string]any)["Item"].([]any)[2].(map[string]any)["Value"] = "EARLY123456"
		req("POST", strings.TrimPrefix(u.RequestURI(), "/api/v1"), value, "", 200)
	}
	fast := req("POST", "/giving/mpesa/stk-push", map[string]any{"requestId": "early-response-fixture-01", "itemId": "book-gateway-early", "amount": 1, "phone": "0700000000"}, member, 202)["transaction"].(map[string]any)
	fastResult := req("GET", "/giving/transactions/"+fast["id"].(string), nil, member, 200)["transaction"].(map[string]any)
	if fastResult["status"] != "success" {
		t.Fatal("submission acknowledgement downgraded a verified callback")
	}
	req("PUT", "/admin/settings/integrations/mpesa", map[string]any{"enabled": false, "values": map[string]string{}}, admin, 200)
	req("POST", "/giving/mpesa/stk-push", payment, member, 503)
	// Hosted cards also bind catalogue price and only settle verified responses.
	req("PUT", "/admin/settings/integrations/flutterwave", map[string]any{"enabled": true, "values": map[string]string{"FLUTTERWAVE_SECRET_KEY": "card-secret-fixture", "FLUTTERWAVE_REDIRECT_URL": "https://api.ministry.invalid/api/v1/giving/card/return", "GIVING_CURRENCY": "USD"}}, admin, 400)
	req("PUT", "/admin/settings/integrations/flutterwave", map[string]any{"enabled": true, "values": map[string]string{"FLUTTERWAVE_SECRET_KEY": "card-secret-fixture", "FLUTTERWAVE_REDIRECT_URL": "https://api.ministry.invalid/api/v1/giving/card/return", "GIVING_CURRENCY": "KES"}}, admin, 200)
	card := map[string]any{"requestId": "card-fixture-01", "itemId": "book-gateway-other", "amount": 1, "email": "member@example.invalid", "phone": "0700000000"}
	result := req("POST", "/giving/card/checkout", card, member, 202)["transaction"].(map[string]any)
	req("POST", "/giving/card/checkout", card, member, 200)
	if cards != 1 || result["amount"] != float64(250) {
		t.Fatal("card idempotency or pricing failed")
	}
	cardVerifiedAmount = 249
	req("GET", "/giving/card/return?tx_ref="+cardID+"&transaction_id=12345", nil, "", 409)
	cardVerifiedAmount = 250
	assertStatus(t, app, "GET", "/api/v1/giving/card/return?tx_ref="+cardID+"&transaction_id=12345", nil, "", 200)
	final = req("GET", "/giving/transactions/"+cardID, nil, member, 200)["transaction"].(map[string]any)
	if final["status"] != "success" {
		t.Fatal("verified card did not settle")
	}
	req("PUT", "/admin/settings/integrations/flutterwave", map[string]any{"enabled": false, "values": map[string]string{}, "clearSecrets": []string{"FLUTTERWAVE_SECRET_KEY"}}, admin, 200)
	saved, _, err := store.Load(ctx, "flutterwave")
	if err != nil || saved.Enabled || saved.Values["FLUTTERWAVE_SECRET_KEY"] != "" {
		t.Fatal("explicit clear did not remove the secret")
	}
	if _, err = db.Exec(ctx, `UPDATE users SET is_active=false WHERE lower(email) IN ('grace.member@example.com','daniel.member@example.com')`); err != nil {
		t.Fatal(err)
	}
	if err = database.CheckProductionAccounts(ctx, db); err != nil {
		t.Fatal("safe accounts failed production startup gate:", err)
	}

}
