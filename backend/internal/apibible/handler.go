package apibible

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	cfg    config.Config
	client *http.Client
}

func NewHandler(cfg config.Config) Handler {
	return Handler{
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type apiBibleLanguage struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	NameLocal string `json:"nameLocal"`
}

type apiBibleAudioRef struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	NameLocal        string `json:"nameLocal"`
	Description      string `json:"description"`
	DescriptionLocal string `json:"descriptionLocal"`
}

type apiBibleBible struct {
	ID                string             `json:"id"`
	DBLID             string             `json:"dblId"`
	Abbreviation      string             `json:"abbreviation"`
	AbbreviationLocal string             `json:"abbreviationLocal"`
	Name              string             `json:"name"`
	NameLocal         string             `json:"nameLocal"`
	Description       string             `json:"description"`
	DescriptionLocal  string             `json:"descriptionLocal"`
	Type              string             `json:"type"`
	Copyright         string             `json:"copyright"`
	Language          apiBibleLanguage   `json:"language"`
	AudioBibles       []apiBibleAudioRef `json:"audioBibles"`
}

type apiBibleAudioBible struct {
	ID               string           `json:"id"`
	Name             string           `json:"name"`
	NameLocal        string           `json:"nameLocal"`
	Description      string           `json:"description"`
	DescriptionLocal string           `json:"descriptionLocal"`
	Language         apiBibleLanguage `json:"language"`
}

type apiBibleBiblesResponse struct {
	Data []apiBibleBible `json:"data"`
}

type apiBibleAudioBiblesResponse struct {
	Data []apiBibleAudioBible `json:"data"`
}

func (h Handler) configured(c *gin.Context) bool {
	if strings.TrimSpace(h.cfg.APIBibleKey) == "" {
		httpx.Error(
			c,
			http.StatusServiceUnavailable,
			"api_bible_key_missing",
			"API_BIBLE_KEY is not configured on the backend",
		)
		return false
	}

	return true
}

func (h Handler) baseURL() string {
	base := strings.TrimSpace(h.cfg.APIBibleBaseURL)
	if base == "" {
		base = "https://rest.api.bible/v1"
	}

	return strings.TrimRight(base, "/")
}

func (h Handler) getJSON(c *gin.Context, path string, query url.Values, target any) bool {
	if !h.configured(c) {
		return false
	}

	endpoint := h.baseURL() + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "api_bible_request_failed", err.Error())
		return false
	}

	req.Header.Set("api-key", strings.TrimSpace(h.cfg.APIBibleKey))
	req.Header.Set("accept", "application/json")

	resp, err := h.client.Do(req)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, "api_bible_unreachable", err.Error())
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var details map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&details)

		c.JSON(resp.StatusCode, gin.H{
			"error":   "api_bible_error",
			"message": "API.Bible returned an error",
			"status":  resp.StatusCode,
			"details": details,
		})
		return false
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		httpx.Error(c, http.StatusBadGateway, "api_bible_decode_failed", err.Error())
		return false
	}

	return true
}

func textMatches(value string, query string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	query = strings.ToLower(strings.TrimSpace(query))

	return query == "" || strings.Contains(value, query)
}

func bibleMatchesQuery(item apiBibleBible, query string) bool {
	if strings.TrimSpace(query) == "" {
		return true
	}

	values := []string{
		item.ID,
		item.DBLID,
		item.Abbreviation,
		item.AbbreviationLocal,
		item.Name,
		item.NameLocal,
		item.Description,
		item.DescriptionLocal,
		item.Language.ID,
		item.Language.Name,
		item.Language.NameLocal,
	}

	for _, value := range values {
		if textMatches(value, query) {
			return true
		}
	}

	return false
}

func languageName(language apiBibleLanguage) string {
	if strings.TrimSpace(language.Name) != "" {
		return language.Name
	}
	return language.NameLocal
}

func shortLabel(item apiBibleBible) string {
	for _, value := range []string{
		item.Abbreviation,
		item.AbbreviationLocal,
		item.NameLocal,
		item.Name,
		item.ID,
	} {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}

	return "Bible"
}

func mapBible(item apiBibleBible) gin.H {
	audioAvailable := len(item.AudioBibles) > 0
	audioStatus := "unavailable"
	if audioAvailable {
		audioStatus = "provider_available"
	}

	return gin.H{
		"id":                 "api_bible_" + item.ID,
		"provider":           "api.bible",
		"providerBibleId":    item.ID,
		"dblId":              item.DBLID,
		"name":               item.Name,
		"nameLocal":          item.NameLocal,
		"shortLabel":         shortLabel(item),
		"abbreviation":       item.Abbreviation,
		"languageCode":       item.Language.ID,
		"languageName":       languageName(item.Language),
		"description":        item.Description,
		"descriptionLocal":   item.DescriptionLocal,
		"license":            item.Copyright,
		"attribution":        "Provided through API.Bible according to configured account access.",
		"downloadable":       false,
		"downloadStatus":     "provider_catalog_only",
		"requiresProvider":   true,
		"disabledReason":     "API.Bible text import is not connected yet.",
		"audioPackAvailable": audioAvailable,
		"audioPackStatus":    audioStatus,
		"audioPackLabel":     "Natural chapter audio pack",
		"audioBibles":        item.AudioBibles,
	}
}

func (h Handler) ListBibles(c *gin.Context) {
	params := url.Values{}
	params.Set("include-full-details", "true")

	if language := strings.TrimSpace(c.Query("language")); language != "" {
		params.Set("language", language)
	}

	var response apiBibleBiblesResponse
	if !h.getJSON(c, "/bibles", params, &response) {
		return
	}

	query := strings.TrimSpace(c.Query("query"))
	versions := make([]gin.H, 0, len(response.Data))

	for _, item := range response.Data {
		if !bibleMatchesQuery(item, query) {
			continue
		}

		versions = append(versions, mapBible(item))
	}

	httpx.OK(c, gin.H{
		"provider": "api.bible",
		"versions": versions,
	})
}

func (h Handler) ListAudioBibles(c *gin.Context) {
	params := url.Values{}
	params.Set("include-full-details", "true")

	if language := strings.TrimSpace(c.Query("language")); language != "" {
		params.Set("language", language)
	}

	var response apiBibleAudioBiblesResponse
	if !h.getJSON(c, "/audio-bibles", params, &response) {
		return
	}

	httpx.OK(c, gin.H{
		"provider":    "api.bible",
		"audioBibles": response.Data,
	})
}
