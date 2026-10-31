package settings

import (
	"encoding/json"
	mailer "github.com/ariga/shekinah-backend/internal/mail"
	"github.com/gin-gonic/gin"
	"net/url"
	"strings"
)

type smtpView struct {
	Enabled            bool   `json:"enabled"`
	Host               string `json:"host"`
	Port               string `json:"port"`
	Username           string `json:"username"`
	From               string `json:"from"`
	Security           string `json:"security"`
	PasswordConfigured bool   `json:"passwordConfigured"`
	Source             string `json:"source"`
}

func safeSMTP(c mailer.Config, source string) smtpView {
	mode := c.Security
	if mode == "auto" {
		mode = "starttls"
	}
	return smtpView{c.Enabled, c.Host, c.Port, c.Username, c.From, mode, c.Password != "", source}
}
func (h Handler) SMTP(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	config, source, e := h.smtp.Load(c.Request.Context())
	if e != nil {
		c.JSON(503, gin.H{"message": "Could not load protected SMTP settings"})
		return
	}
	c.JSON(200, gin.H{"smtp": safeSMTP(config, source)})
}
func (h Handler) UpdateSMTP(c *gin.Context) {
	var r struct {
		Enabled       bool   `json:"enabled"`
		Host          string `json:"host"`
		Port          string `json:"port"`
		Username      string `json:"username"`
		Password      string `json:"password"`
		ClearPassword bool   `json:"clearPassword"`
		From          string `json:"from"`
		Security      string `json:"security"`
	}
	if c.ShouldBindJSON(&r) != nil {
		c.JSON(400, gin.H{"message": "Check SMTP settings"})
		return
	}
	old, _, e := h.smtp.Load(c.Request.Context())
	if e != nil {
		c.JSON(503, gin.H{"message": "Could not load protected SMTP settings"})
		return
	}
	password := old.Password
	if r.ClearPassword {
		password = ""
	} else if r.Password != "" {
		password = r.Password
	}
	config := mailer.Config{Enabled: r.Enabled, Host: strings.TrimSpace(r.Host), Port: strings.TrimSpace(r.Port), Username: strings.TrimSpace(r.Username), Password: password, From: strings.TrimSpace(r.From), Security: r.Security}
	if e = config.Validate(); e != nil {
		c.JSON(400, gin.H{"message": e.Error()})
		return
	}
	if e = h.smtp.Save(c.Request.Context(), config); e != nil {
		c.JSON(503, gin.H{"message": "Could not save protected SMTP settings"})
		return
	}
	c.JSON(200, gin.H{"smtp": safeSMTP(config, "admin"), "message": "SMTP settings saved. New emails use these settings immediately."})
}
func (h Handler) CheckSMTP(c *gin.Context) {
	config, _, e := h.smtp.Load(c.Request.Context())
	if e != nil {
		c.JSON(503, gin.H{"message": "Could not load protected SMTP settings"})
		return
	}
	if !config.Configured() {
		c.JSON(400, gin.H{"message": "Save and enable SMTP first"})
		return
	}
	if e = mailer.Check(config); e != nil {
		c.JSON(502, gin.H{"message": "SMTP connection or authentication failed. Check the host, port, encryption and credentials."})
		return
	}
	c.JSON(200, gin.H{"message": "SMTP connection and authentication succeeded. No email was sent."})
}

type Production struct {
	APIURL       string `json:"apiUrl"`
	DashboardURL string `json:"dashboardUrl"`
	AppURL       string `json:"appUrl"`
	WebsiteURL   string `json:"websiteUrl"`
}

func (h Handler) Production(c *gin.Context) {
	var raw string
	var p Production
	if e := h.db.QueryRow(c.Request.Context(), `SELECT value FROM app_settings WHERE key='production_urls'`).Scan(&raw); e == nil {
		_ = json.Unmarshal([]byte(raw), &p)
	}
	var ministryRaw string
	var ministry Ministry
	if e := h.db.QueryRow(c.Request.Context(), `SELECT value FROM app_settings WHERE key='ministry_details'`).Scan(&ministryRaw); e == nil {
		_ = json.Unmarshal([]byte(ministryRaw), &ministry)
		p.AppURL = ministry.AppURL
		p.WebsiteURL = ministry.Website
	}
	c.JSON(200, gin.H{"production": p})
}
func (h Handler) UpdateProduction(c *gin.Context) {
	var p Production
	if c.ShouldBindJSON(&p) != nil {
		c.JSON(400, gin.H{"message": "Check production URLs"})
		return
	}
	for _, field := range []*string{&p.APIURL, &p.DashboardURL, &p.AppURL, &p.WebsiteURL} {
		*field = strings.TrimSpace(*field)
		if *field == "" {
			continue
		}
		u, e := url.Parse(*field)
		if e != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Fragment != "" || len(*field) > 500 {
			c.JSON(400, gin.H{"message": "Use full HTTPS URLs without passwords or fragments, or leave blank"})
			return
		}
	}
	if p.APIURL != "" {
		u, _ := url.Parse(p.APIURL)
		if u.Path != "" && u.Path != "/" || u.RawQuery != "" {
			c.JSON(400, gin.H{"message": "API URL must be the server origin, without /api/v1 or a query"})
			return
		}
		p.APIURL = strings.TrimRight(p.APIURL, "/")
	}
	raw, _ := json.Marshal(p)
	tx, e := h.db.Begin(c.Request.Context())
	if e != nil {
		c.JSON(500, gin.H{"message": "Could not save production URLs"})
		return
	}
	defer tx.Rollback(c.Request.Context())
	_, e = tx.Exec(c.Request.Context(), `INSERT INTO app_settings(key,value)VALUES('production_urls',$1)ON CONFLICT(key)DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, string(raw))
	// Keep the existing public ministry links and app share button in sync.
	if e == nil {
		_, e = tx.Exec(c.Request.Context(), `INSERT INTO app_settings(key,value)VALUES('ministry_details',jsonb_build_object('appUrl',$1::text,'website',$2::text)::text)ON CONFLICT(key)DO UPDATE SET value=(app_settings.value::jsonb||jsonb_build_object('appUrl',$1::text,'website',$2::text))::text,updated_at=NOW()`, p.AppURL, p.WebsiteURL)
	}
	if e == nil {
		e = tx.Commit(c.Request.Context())
	}
	if e != nil {
		c.JSON(500, gin.H{"message": "Could not save production URLs"})
		return
	}
	c.JSON(200, gin.H{"production": p, "message": "Public URLs saved. Hosting, HTTPS certificates and signed app releases are configured during deployment."})
}
