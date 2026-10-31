package settings

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"net/mail"
	"net/url"
	"strings"
)

type Ministry struct {
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Address  string `json:"address"`
	Website  string `json:"website"`
	RadioURL string `json:"radioUrl"`
	TVURL    string `json:"tvUrl"`
	AppURL   string `json:"appUrl"`
}

func (h Handler) Ministry(c *gin.Context) {
	var raw string
	var value Ministry
	_ = h.db.QueryRow(c.Request.Context(), `SELECT value FROM app_settings WHERE key='ministry_details'`).Scan(&raw)
	_ = json.Unmarshal([]byte(raw), &value)
	c.JSON(200, gin.H{"ministry": value})
}
func (h Handler) UpdateMinistry(c *gin.Context) {
	var value Ministry
	if c.ShouldBindJSON(&value) != nil {
		c.JSON(400, gin.H{"message": "Check ministry details"})
		return
	}
	for _, field := range []*string{&value.Phone, &value.Email, &value.Address, &value.Website, &value.RadioURL, &value.TVURL, &value.AppURL} {
		*field = strings.TrimSpace(*field)
		if len(*field) > 500 {
			c.JSON(400, gin.H{"message": "Details must be under 500 characters each"})
			return
		}
	}
	for _, link := range []string{value.Website, value.RadioURL, value.TVURL, value.AppURL} {
		if link == "" {
			continue
		}
		u, err := url.Parse(link)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Hostname() == "example.com" || strings.HasSuffix(u.Hostname(), ".example.com") {
			c.JSON(400, gin.H{"message": "Use a real HTTPS link, or leave it blank"})
			return
		}
	}
	if value.Email != "" {
		if _, err := mail.ParseAddress(value.Email); err != nil {
			c.JSON(400, gin.H{"message": "Check the contact email"})
			return
		}
	}
	raw, _ := json.Marshal(value)
	_, err := h.db.Exec(c.Request.Context(), `INSERT INTO app_settings(key,value)VALUES('ministry_details',$1)ON CONFLICT(key)DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, string(raw))
	if err != nil {
		c.JSON(500, gin.H{"message": "Could not save ministry details"})
		return
	}
	c.JSON(200, gin.H{"ministry": value})
}
