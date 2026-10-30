// Package bibleaudio keeps the Bible Brain key on the server. Filesets are
// explicitly mapped to installed text versions; language alone never implies
// that a recording is the same translation as the reader's text.
package bibleaudio

import (
	"encoding/json"
	"fmt"
	"github.com/ariga/shekinah-backend/internal/integrations"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
)

type Mapping struct {
	Fileset     string `json:"fileset"`
	Attribution string `json:"attribution"`
}
type Handler struct {
	client *http.Client
	store  *integrations.Store
}

func NewHandler() Handler                                           { return Handler{client: &http.Client{Timeout: 15 * 1e9}} }
func (h Handler) WithIntegrations(store integrations.Store) Handler { h.store = &store; return h }
func (h Handler) Chapter(c *gin.Context) {
	raw, key := os.Getenv("BIBLE_BRAIN_FILESETS"), strings.TrimSpace(os.Getenv("BIBLE_BRAIN_KEY"))
	if h.store != nil {
		cfg, _, err := h.store.Load(c.Request.Context(), "biblebrain")
		if err != nil {
			c.JSON(503, gin.H{"message": "Narration settings are unavailable"})
			return
		}
		raw = cfg.Values["BIBLE_BRAIN_FILESETS"]
		key = ""
		if cfg.Enabled {
			key = cfg.Values["BIBLE_BRAIN_KEY"]
		}
	}
	var mappings map[string]Mapping
	_ = json.Unmarshal([]byte(raw), &mappings)
	mapping := mappings[c.Param("version")]
	if key == "" || mapping.Fileset == "" || mapping.Attribution == "" {
		c.JSON(200, gin.H{"available": false, "reason": "Recorded narration has not been configured for this translation."})
		return
	}
	book := strings.ToUpper(c.Param("book"))
	chapter, err := strconv.Atoi(c.Param("chapter"))
	if err != nil || chapter < 1 || chapter > 150 || !regexp.MustCompile(`^[A-Z0-9]{3}$`).MatchString(book) || !regexp.MustCompile(`^[A-Za-z0-9_-]+$`).MatchString(mapping.Fileset) {
		c.JSON(400, gin.H{"message": "Check the chapter reference"})
		return
	}
	base := strings.TrimRight(os.Getenv("BIBLE_BRAIN_BASE_URL"), "/")
	if base == "" {
		base = "https://4.dbt.io/api"
	}
	fetch := func(path string, out any) error {
		u, err := url.Parse(base + path)
		if err != nil {
			return err
		}
		q := u.Query()
		q.Set("key", key)
		q.Set("v", "4")
		u.RawQuery = q.Encode()
		req, err := http.NewRequestWithContext(c.Request.Context(), "GET", u.String(), nil)
		if err != nil {
			return err
		}
		resp, err := h.client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			return fmt.Errorf("narration provider unavailable")
		}
		return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out)
	}
	var result struct {
		Data []struct {
			Path string `json:"path"`
			URL  string `json:"url"`
		} `json:"data"`
	}
	path := "/bibles/filesets/" + mapping.Fileset + "/" + book + "/" + strconv.Itoa(chapter)
	if err = fetch(path, &result); err != nil || len(result.Data) == 0 {
		c.JSON(503, gin.H{"message": "Recorded narration is temporarily unavailable"})
		return
	}
	audio := result.Data[0].Path
	if audio == "" {
		audio = result.Data[0].URL
	}
	u, err := url.Parse(audio)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" {
		c.JSON(502, gin.H{"message": "Narration provider returned an invalid recording"})
		return
	}
	var times struct {
		Data []struct {
			Verse json.Number `json:"verse_start"`
			Time  json.Number `json:"timestamp"`
		} `json:"data"`
	}
	_ = fetch("/timestamps/"+mapping.Fileset+"/"+book+"/"+strconv.Itoa(chapter), &times)
	timing := []gin.H{}
	for _, t := range times.Data {
		v, _ := strconv.Atoi(string(t.Verse))
		seconds, _ := strconv.ParseFloat(string(t.Time), 64)
		if v > 0 && seconds >= 0 {
			timing = append(timing, gin.H{"verse": v, "positionMs": int64(seconds * 1000)})
		}
	}
	c.Header("Cache-Control", "private, no-store")
	c.JSON(200, gin.H{"available": true, "url": audio, "attribution": mapping.Attribution, "timings": timing})
}
