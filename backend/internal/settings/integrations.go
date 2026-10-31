package settings

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/integrations"
	"github.com/gin-gonic/gin"
)

func (h Handler) integrations() integrations.Store {
	return integrations.Store{DB: h.db, Secret: h.smtp.Secret}
}
func (h Handler) WithProviderClient(client *http.Client) Handler {
	if client != nil {
		h.providerClient = client
	}
	return h
}
func (h Handler) Integrations(c *gin.Context) {
	views := []integrations.View{}
	for _, def := range integrations.Definitions {
		v, e := h.integrations().GetView(c.Request.Context(), def.ID)
		if e != nil {
			c.JSON(503, gin.H{"message": "Could not load protected provider settings"})
			return
		}
		views = append(views, v)
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"integrations": views})
}
func (h Handler) UpdateIntegration(c *gin.Context) {
	id := c.Param("provider")
	if _, ok := integrations.DefinitionFor(id); !ok {
		c.JSON(404, gin.H{"message": "Unknown provider"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512<<10)
	var req struct {
		Enabled bool              `json:"enabled"`
		Values  map[string]string `json:"values"`
		Clear   []string          `json:"clearSecrets"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"message": "Check integration settings"})
		return
	}
	if e := h.integrations().Save(c.Request.Context(), id, req.Enabled, req.Values, req.Clear); e != nil {
		c.JSON(400, gin.H{"message": e.Error()})
		return
	}
	view, e := h.integrations().GetView(c.Request.Context(), id)
	if e != nil {
		c.JSON(503, gin.H{"message": "Settings saved, but their status could not be loaded"})
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"integration": view, "message": "Settings saved. New provider requests use this configuration."})
}
func (h Handler) CheckIntegration(c *gin.Context) {
	id := c.Param("provider")
	def, ok := integrations.DefinitionFor(id)
	if !ok {
		c.JSON(404, gin.H{"message": "Unknown provider"})
		return
	}
	config, _, e := h.integrations().Load(c.Request.Context(), id)
	if e != nil {
		c.JSON(503, gin.H{"message": "Protected provider settings are unavailable"})
		return
	}
	if !config.Enabled {
		c.JSON(400, gin.H{"message": "Save and enable this integration first"})
		return
	}
	if e = integrations.Validate(def, config); e != nil {
		c.JSON(400, gin.H{"message": e.Error()})
		return
	}
	if id == "firebase" || id == "cloudinary" {
		c.JSON(200, gin.H{"message": "Saved credential format is valid. No message or upload was sent."})
		return
	}
	var endpoint, header, value string
	switch id {
	case "mpesa":
		base := "https://sandbox.safaricom.co.ke"
		if config.Values["MPESA_ENV"] == "production" {
			base = "https://api.safaricom.co.ke"
		}
		endpoint = base + "/oauth/v1/generate?grant_type=client_credentials"
	case "flutterwave":
		endpoint = "https://api.flutterwave.com/v3/banks/KE"
		header = "Authorization"
		value = "Bearer " + config.Values["FLUTTERWAVE_SECRET_KEY"]
	case "apibible":
		endpoint = "https://rest.api.bible/v1/bibles"
		header = "api-key"
		value = config.Values["API_BIBLE_KEY"]
	case "biblebrain":
		endpoint = "https://4.dbt.io/api/bibles?v=4&limit=1&key=" + url.QueryEscape(config.Values["BIBLE_BRAIN_KEY"])
	case "cloudflare-stream":
		endpoint = "https://api.cloudflare.com/client/v4/accounts/" + url.PathEscape(config.Values["CLOUDFLARE_ACCOUNT_ID"]) + "/stream?per_page=1"
		header = "Authorization"
		value = "Bearer " + config.Values["CLOUDFLARE_STREAM_API_TOKEN"]
	default:
		c.JSON(400, gin.H{"message": "This provider has no connection check"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	request, e := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if e != nil {
		c.JSON(400, gin.H{"message": "Invalid provider configuration"})
		return
	}
	if id == "mpesa" {
		request.SetBasicAuth(config.Values["MPESA_CONSUMER_KEY"], config.Values["MPESA_CONSUMER_SECRET"])
	} else {
		request.Header.Set(header, value)
	}
	client := h.providerClient
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second, CheckRedirect: func(r *http.Request, v []*http.Request) error { return http.ErrUseLastResponse }}
	}
	response, e := client.Do(request)
	if e != nil {
		c.JSON(502, gin.H{"message": "Could not reach the provider. Check connectivity and saved settings."})
		return
	}
	defer response.Body.Close()
	var body map[string]any
	_ = json.NewDecoder(io.LimitReader(response.Body, 256<<10)).Decode(&body)
	if response.StatusCode < 200 || response.StatusCode >= 300 || (id == "mpesa" && body["access_token"] == nil) || (id == "cloudflare-stream" && body["success"] != true) {
		c.JSON(502, gin.H{"message": "Provider authentication failed. Check the saved credentials and permissions."})
		return
	}
	message := "Provider accepted the saved credentials. No payment, upload, email or push was sent."
	if id == "mpesa" {
		message = "M-Pesa consumer authentication succeeded. No payment prompt was sent. Verify shortcode/passkey and callback delivery in a controlled payment acceptance test."
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"message": message})
}

type readinessRow struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

func (h Handler) Readiness(c *gin.Context) {
	checks := []readinessRow{}
	for _, d := range integrations.Definitions {
		cfg, _, e := h.integrations().Load(c.Request.Context(), d.ID)
		status, message := "optional", "Not enabled"
		if d.ID == "mpesa" {
			status = "needs-setup"
			message = "Configure consumer credentials, merchant details and a public HTTPS callback to enable automatic M-Pesa."
		}
		if e != nil {
			status = "blocked"
			message = "Protected settings could not be read"
		} else if cfg.Enabled {
			if e = integrations.Validate(d, cfg); e != nil {
				status = "needs-setup"
				message = e.Error()
			} else {
				status = "configured"
				message = "Settings saved; provider and delivery acceptance still required"
			}
		}
		checks = append(checks, readinessRow{d.ID, d.Title, status, message})
	}
	add := func(id, title string, ok bool, message string) {
		status := "ready"
		if !ok {
			status = "deployment"
		}
		checks = append(checks, readinessRow{id, title, status, message})
	}
	add("server-key", "Server signing/encryption root", len(h.smtp.Secret) >= 32 && !strings.Contains(strings.ToLower(h.smtp.Secret), "dev-only"), "Set a strong persistent server key through deployment secrets; keep it stable for encrypted settings.")
	add("r2", "R2 storage", os.Getenv("R2_ACCESS_KEY_ID") != "" && os.Getenv("R2_SECRET_ACCESS_KEY") != "" && (os.Getenv("R2_BUCKET") != "" || os.Getenv("R2_SERMONS_BUCKET") != ""), "Storage account credentials, bucket access and durable staging are configured at deployment.")
	libraryKey, _ := base64.StdEncoding.DecodeString(os.Getenv("LIBRARY_ENCRYPTION_KEY"))
	add("library-encryption", "Paid media encryption", len(libraryKey) == 32, "Keep the library encryption root in deployment secrets and retain a backup; never rotate it as a provider setting.")
	for _, cmd := range []string{"ffmpeg", "pdftoppm"} {
		_, e := exec.LookPath(cmd)
		add(cmd, fmt.Sprintf("Media tool · %s", cmd), e == nil, "Required on the API host for recordings and automatic book covers.")
	}
	smtp, _, e := h.smtp.Load(c.Request.Context())
	add("smtp", "SMTP", e == nil && smtp.Configured(), "Configure outgoing email in Settings, then check the connection.")
	add("push-delivery", "Notification delivery", os.Getenv("NOTIFICATIONS_DELIVERY_ENABLED") != "false", "Local QA disables outbound delivery. Enable it deliberately in production.")
	accountErr := database.CheckProductionAccounts(c.Request.Context(), h.db)
	add("accounts", "Production account safety", accountErr == nil, "Replace or deactivate demonstration accounts before production. This check does not change any account.")
	add("hosting", "Production hosting, HTTPS and signed APK", false, "Complete domain/TLS, database backup/storage mounts, media ports, callback reachability and Android release signing during deployment.")
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"checks": checks, "note": "Configuration status is not a security certification. Live payments and delivery need controlled acceptance tests."})
}
