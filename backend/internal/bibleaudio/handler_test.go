package bibleaudio

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecordedNarrationMappingKeepsKeyOnServer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := "private-key-fixture"
	t.Setenv("BIBLE_BRAIN_KEY", secret)
	t.Setenv("BIBLE_BRAIN_FILESETS", `{"kjv":{"fileset":"approved-fileset","attribution":"Approved publisher copyright"}}`)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("key") != secret || r.URL.Query().Get("v") != "4" {
			t.Error("missing provider authentication")
		}
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(r.URL.Path, "timestamps") {
			_, _ = w.Write([]byte(`{"data":[{"verse_start":"1","timestamp":"0.25"},{"verse_start":2,"timestamp":1.5}]}`))
		} else {
			_, _ = w.Write([]byte(`{"data":[{"path":"https://recordings.example.invalid/chapter.mp3"}]}`))
		}
	}))
	defer provider.Close()
	t.Setenv("BIBLE_BRAIN_BASE_URL", provider.URL)
	h := NewHandler()
	r := gin.New()
	r.GET("/:version/:book/:chapter", h.Chapter)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest("GET", "/kjv/GEN/1", nil))
	if rr.Code != 200 || strings.Contains(rr.Body.String(), secret) {
		t.Fatalf("unsafe narration response: %d %s", rr.Code, rr.Body.String())
	}
	var result struct {
		Available   bool
		Attribution string
		Timings     []struct {
			Verse      int
			PositionMs int64
		}
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if !result.Available || len(result.Timings) != 2 || result.Timings[0].PositionMs != 250 || result.Attribution == "" {
		t.Fatalf("recording metadata lost: %s", rr.Body.String())
	}
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest("GET", "/unmapped/GEN/1", nil))
	if !strings.Contains(rr.Body.String(), `"available":false`) {
		t.Fatal("unmapped translation borrowed another translation's recording")
	}
}
