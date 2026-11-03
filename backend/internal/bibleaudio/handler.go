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

// The Berean Standard Bible read by Bob Souer (CC0), stored with the
// church's media as bible-audio/bsb-souer/BB_CCC.mp3. The app has the verse
// timings built in; this only says where the recordings live.
const bsbAttribution = "Read by Bob Souer · Berean Standard Bible audio, public domain (CC0)"

var bsbBooks = []string{"GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
	"MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"}

func bsbBase() string {
	if v := strings.TrimRight(os.Getenv("BSB_AUDIO_BASE_URL"), "/"); v != "" {
		return v
	}
	if v := strings.TrimRight(os.Getenv("R2_SERMONS_PUBLIC_BASE_URL"), "/"); v != "" {
		return v + "/bible-audio/bsb-souer"
	}
	return ""
}

func (h Handler) bsb(c *gin.Context) {
	base := bsbBase()
	book := strings.ToUpper(c.Param("book"))
	chapter, err := strconv.Atoi(c.Param("chapter"))
	n := 0
	for i, b := range bsbBooks {
		if b == book {
			n = i + 1
		}
	}
	if base == "" || n == 0 || err != nil || chapter < 1 || chapter > 150 {
		c.JSON(200, gin.H{"available": false, "reason": "Recorded narration is not available for this chapter."})
		return
	}
	c.Header("Cache-Control", "public, max-age=3600")
	c.JSON(200, gin.H{"available": true, "url": fmt.Sprintf("%s/%02d_%03d.mp3", base, n, chapter), "base": base, "attribution": bsbAttribution, "timings": []any{}})
}

func (h Handler) Chapter(c *gin.Context) {
	if c.Param("version") == "eng_bsb" {
		h.bsb(c)
		return
	}
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
