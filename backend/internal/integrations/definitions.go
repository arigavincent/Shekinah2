package integrations

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"net/url"
	"regexp"
	"strings"
)

func field(key, label, kind string, required bool, hint string) Field {
	return Field{Key: key, Label: label, Kind: kind, Required: required, Hint: hint}
}

var Definitions = []Definition{
	{ID: "mpesa", Title: "M-Pesa Daraja", Description: "Consumer credentials, merchant details and secure STK callbacks. Connection checks never request money.", EnableKeys: []string{"MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY", "MPESA_SHORTCODE", "MPESA_CALLBACK_URL", "MPESA_CALLBACK_TOKEN"}, Fields: []Field{
		{Key: "MPESA_ENV", Label: "Environment", Kind: "select", Options: []string{"sandbox", "production"}, Default: "sandbox"},
		field("MPESA_CONSUMER_KEY", "Consumer key", "secret", true, "From the Daraja app."), field("MPESA_CONSUMER_SECRET", "Consumer secret", "secret", true, ""), field("MPESA_SHORTCODE", "Business shortcode / store number", "text", true, "Use the business or store shortcode approved for this Daraja app."), field("MPESA_PARTY_B", "Receiving paybill / till number", "text", false, "For Buy Goods enter the till number. For Paybill, leave blank to use the business shortcode."), field("MPESA_PASSKEY", "Lipa na M-Pesa passkey", "secret", true, ""),
		field("MPESA_CALLBACK_URL", "Public callback URL", "url", true, "HTTPS URL ending /api/v1/giving/mpesa/callback. STK requests attach callback security automatically."), field("MPESA_CALLBACK_TOKEN", "Callback security token", "secret", false, "Generated securely when enabled if no token is provided. Existing requests retain their original callback verification."),
		{Key: "MPESA_TRANSACTION_TYPE", Label: "Merchant type", Kind: "select", Options: []string{"CustomerPayBillOnline", "CustomerBuyGoodsOnline"}, Default: "CustomerPayBillOnline"},
		{Key: "MPESA_ACCOUNT_REFERENCE", Label: "Account reference", Kind: "text", Default: "Shekinah"},
	}},
	{ID: "flutterwave", Title: "Card payments · Flutterwave", Description: "Hosted card checkout and server-verified return payments.", EnableKeys: []string{"FLUTTERWAVE_SECRET_KEY"}, Fields: []Field{field("FLUTTERWAVE_SECRET_KEY", "Secret API key", "secret", true, "Use the same merchant account for pending payments."), field("FLUTTERWAVE_REDIRECT_URL", "Payment return URL", "url", true, "HTTPS URL ending /api/v1/giving/card/return."), {Key: "GIVING_CURRENCY", Label: "Currency · app prices", Kind: "select", Options: []string{"KES"}, Default: "KES"}}},
	{ID: "biblebrain", Title: "Recorded Bible narration · Bible Brain", Description: "Licensed recordings matched explicitly to each Bible translation.", EnableKeys: []string{"BIBLE_BRAIN_KEY"}, Fields: []Field{field("BIBLE_BRAIN_KEY", "Bible Brain API key", "secret", true, ""), field("BIBLE_BRAIN_FILESETS", "Translation filesets & attribution", "json", true, `Map translation IDs to approved filesets: {"kjv":{"fileset":"approved-fileset","attribution":"Publisher copyright"}}.`)}},
	{ID: "apibible", Title: "Bible translations · API.Bible", Description: "Server-side Bible catalogue and translation imports; the key stays off member devices.", EnableKeys: []string{"API_BIBLE_KEY"}, Fields: []Field{field("API_BIBLE_KEY", "API.Bible API key", "secret", true, "")}},
	{ID: "cloudflare-stream", Title: "Cloudflare Stream (optional)", Description: "Optional managed video uploads and external live inputs, alongside the built-in R2 live recorder.", EnableKeys: []string{"CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_STREAM_API_TOKEN"}, Fields: []Field{field("CLOUDFLARE_ACCOUNT_ID", "Cloudflare account ID", "text", true, ""), field("CLOUDFLARE_STREAM_API_TOKEN", "Stream API token", "secret", true, "Use an account-scoped token with the Stream permissions you need.")}},
	{ID: "cloudinary", Title: "Cloudinary images (optional)", Description: "Optional image uploads for existing content editors. Protected books and recordings continue to use deployment storage.", EnableKeys: []string{"CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"}, Fields: []Field{field("CLOUDINARY_CLOUD_NAME", "Cloud name", "text", true, ""), field("CLOUDINARY_API_KEY", "API key", "secret", true, ""), field("CLOUDINARY_API_SECRET", "API secret", "secret", true, "")}},
	{ID: "firebase", Title: "Firebase push notifications", Description: "Server service-account credentials for the Android app's existing Firebase project.", EnableKeys: []string{"FCM_SERVICE_ACCOUNT_JSON"}, Fields: []Field{field("FCM_SERVICE_ACCOUNT_JSON", "Service account JSON", "secret", true, "Paste the service account JSON for the same Firebase project used by the APK. Stored encrypted and never returned.")}},
}

func DefinitionFor(id string) (Definition, bool) {
	for _, d := range Definitions {
		if d.ID == id {
			return d, true
		}
	}
	return Definition{}, false
}
func Validate(d Definition, c Config) error {
	for _, f := range d.Fields {
		v := c.Values[f.Key]
		if len(v) > 128<<10 {
			return errors.New("integration value is too large")
		}
		if f.Kind != "json" && f.Kind != "secret" && (len(v) > 2000 || strings.ContainsAny(v, "\r\n")) {
			return fmt.Errorf("check %s", f.Label)
		}
		if c.Enabled && f.Required && v == "" {
			return fmt.Errorf("%s is required", f.Label)
		}
		if v != "" && f.Kind == "select" {
			valid := false
			for _, o := range f.Options {
				valid = valid || v == o
			}
			if !valid {
				return fmt.Errorf("choose a valid %s", f.Label)
			}
		}
		if v != "" && f.Kind == "url" {
			u, e := url.Parse(v)
			if e != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Hostname() == "example.com" || strings.HasSuffix(u.Hostname(), ".example.com") {
				return fmt.Errorf("%s must be a real HTTPS URL without a query or fragment", f.Label)
			}
		}
	}
	if v := c.Values["MPESA_SHORTCODE"]; v != "" && !regexp.MustCompile(`^[0-9]{5,6}$`).MatchString(v) {
		return errors.New("use a valid M-Pesa shortcode")
	}
	if v := c.Values["MPESA_PARTY_B"]; v != "" && !regexp.MustCompile(`^[0-9]{5,10}$`).MatchString(v) {
		return errors.New("use a valid receiving paybill or till number")
	}
	if c.Enabled && c.Values["MPESA_TRANSACTION_TYPE"] == "CustomerBuyGoodsOnline" && c.Values["MPESA_PARTY_B"] == "" {
		return errors.New("receiving till number is required for Buy Goods")
	}
	if v := c.Values["MPESA_ACCOUNT_REFERENCE"]; v != "" && !regexp.MustCompile(`^[A-Za-z0-9]{1,12}$`).MatchString(v) {
		return errors.New("account reference must contain up to 12 letters or numbers")
	}
	if v := c.Values["MPESA_CALLBACK_URL"]; v != "" {
		u, _ := url.Parse(v)
		if u == nil || u.Path != "/api/v1/giving/mpesa/callback" {
			return errors.New("M-Pesa callback must end /api/v1/giving/mpesa/callback")
		}
	}
	if v := c.Values["MPESA_CALLBACK_TOKEN"]; c.Enabled && v != "" && len(v) < 24 {
		return errors.New("use at least 24 characters for the callback security token")
	}
	if v := c.Values["FLUTTERWAVE_REDIRECT_URL"]; v != "" {
		u, _ := url.Parse(v)
		if u == nil || u.Path != "/api/v1/giving/card/return" {
			return errors.New("card return URL must end /api/v1/giving/card/return")
		}
	}
	if v := c.Values["GIVING_CURRENCY"]; v != "" && !regexp.MustCompile(`^[A-Z]{3}$`).MatchString(v) {
		return errors.New("use a three-letter uppercase currency")
	}
	if v := c.Values["CLOUDFLARE_ACCOUNT_ID"]; v != "" && !regexp.MustCompile(`^[a-fA-F0-9]{32}$`).MatchString(v) {
		return errors.New("use the 32-character Cloudflare account ID")
	}
	if v := c.Values["CLOUDINARY_CLOUD_NAME"]; v != "" && !regexp.MustCompile(`^[A-Za-z0-9_-]{1,100}$`).MatchString(v) {
		return errors.New("check the Cloudinary cloud name")
	}
	if raw := c.Values["BIBLE_BRAIN_FILESETS"]; raw != "" {
		var values map[string]struct {
			Fileset     string `json:"fileset"`
			Attribution string `json:"attribution"`
		}
		if json.Unmarshal([]byte(raw), &values) != nil || len(values) > 200 {
			return errors.New("use a valid translation-to-fileset JSON object")
		}
		for key, m := range values {
			if !regexp.MustCompile(`^[A-Za-z0-9_-]+$`).MatchString(key) || !regexp.MustCompile(`^[A-Za-z0-9_-]+$`).MatchString(m.Fileset) || strings.TrimSpace(m.Attribution) == "" || len(m.Attribution) > 5000 {
				return errors.New("each translation needs an approved fileset and attribution")
			}
		}
	}
	if raw := c.Values["FCM_SERVICE_ACCOUNT_JSON"]; raw != "" {
		var a struct {
			Type     string `json:"type"`
			Project  string `json:"project_id"`
			Email    string `json:"client_email"`
			Key      string `json:"private_key"`
			TokenURI string `json:"token_uri"`
		}
		if json.Unmarshal([]byte(raw), &a) != nil || a.Type != "service_account" || a.Project == "" || !strings.Contains(a.Email, "@") {
			return errors.New("use a Firebase service account JSON file")
		}
		if a.TokenURI != "" && a.TokenURI != "https://oauth2.googleapis.com/token" {
			return errors.New("Firebase service account must use Google's OAuth token endpoint")
		}
		if _, e := jwt.ParseRSAPrivateKeyFromPEM([]byte(a.Key)); e != nil {
			return errors.New("service account private key is invalid")
		}
	}
	return nil
}
