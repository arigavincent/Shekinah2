package bibleversions

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db     *pgxpool.Pool
	cfg    config.Config
	client *http.Client
}

type Version struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Abbreviation        string `json:"abbreviation"`
	LanguageCode        string `json:"languageCode"`
	LanguageName        string `json:"languageName"`
	License             string `json:"license"`
	Attribution         string `json:"attribution"`
	Provider            string `json:"provider"`
	DownloadURL         string `json:"downloadUrl"`
	FallbackDownloadURL string `json:"fallbackDownloadUrl,omitempty"`
	FileType            string `json:"fileType"`
}

var titlePattern = regexp.MustCompile(`(?is)<h1[^>]*>(.*?)</h1>`)
var hrefPattern = regexp.MustCompile(`href=["']([^"']+_vpl\.zip)["']`)

func NewHandler(db *pgxpool.Pool, cfg config.Config) Handler {
	return Handler{
		db:  db,
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func localCatalog() []Version {
	return []Version{
		{
			ID:                  "engmsb",
			Name:                "Majority Standard Bible",
			Abbreviation:        "MSB",
			LanguageCode:        "eng",
			LanguageName:        "English",
			License:             "Public Domain",
			Attribution:         "Berean Bible Translation Committee",
			Provider:            "eBible mirror",
			DownloadURL:         "https://ebible.org/Scriptures/engmsb_vpl.zip",
			FallbackDownloadURL: "/api/v1/bible/versions/engmsb/download",
			FileType:            "vpl-zip",
		},
		{
			ID:                  "swhonen",
			Name:                "Open Kiswahili Contemporary Version (Neno)",
			Abbreviation:        "NENO",
			LanguageCode:        "swh",
			LanguageName:        "Kiswahili",
			License:             "CC BY-SA 4.0",
			Attribution:         "Biblica, Inc.",
			Provider:            "eBible mirror",
			DownloadURL:         "https://ebible.org/Scriptures/swhonen_vpl.zip",
			FallbackDownloadURL: "/api/v1/bible/versions/swhonen/download",
			FileType:            "vpl-zip",
		},
	}
}

func sampleFilePath(versionID string) string {
	switch versionID {
	case "engmsb":
		return filepath.Join("..", "phase1_app", "tmp", "bible-source", "engmsb_vpl.zip")
	case "swhonen":
		return filepath.Join("..", "phase1_app", "tmp", "bible-source", "swhonen_vpl.zip")
	default:
		return ""
	}
}

func cleanText(value string) string {
	value = strings.ReplaceAll(value, "\n", " ")
	value = strings.ReplaceAll(value, "\r", " ")
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(value, " "))
}

func parseCatalogFromHTML(body string) []Version {
	matches := hrefPattern.FindAllStringSubmatch(body, -1)
	if len(matches) == 0 {
		return nil
	}

	items := make([]Version, 0, len(matches))
	seen := map[string]bool{}

	for _, match := range matches {
		link := strings.TrimSpace(match[1])
		if link == "" {
			continue
		}

		absolute := link
		if !strings.HasPrefix(strings.ToLower(absolute), "http") {
			absolute = "https://ebible.org/Scriptures/" + strings.TrimLeft(absolute, "/")
		}

		base := filepath.Base(absolute)
		id := strings.TrimSuffix(base, "_vpl.zip")
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true

		language := "Unknown"
		if len(id) >= 3 {
			switch id[:3] {
			case "eng":
				language = "English"
			case "swh":
				language = "Kiswahili"
			}
		}

		items = append(items, Version{
			ID:           id,
			Name:         strings.ToUpper(id),
			Abbreviation: strings.ToUpper(id),
			LanguageCode: id[:min(3, len(id))],
			LanguageName: language,
			License:      "Provider supplied",
			Attribution:  "eBible.org",
			Provider:     "eBible.org",
			DownloadURL:  absolute,
			FileType:     "vpl-zip",
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})

	return items
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (h Handler) List(c *gin.Context) {
	items := localCatalog()

	resp, err := h.client.Get("https://ebible.org/Scriptures/")
	if err == nil && resp != nil {
		defer resp.Body.Close()
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
		if readErr == nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if parsed := parseCatalogFromHTML(string(body)); len(parsed) > 0 {
				items = parsed
			}
		}
	}

	query := strings.ToLower(strings.TrimSpace(c.Query("query")))
	if query != "" {
		filtered := make([]Version, 0, len(items))
		for _, item := range items {
			searchable := strings.ToLower(item.ID + " " + item.Name + " " + item.LanguageName + " " + item.LanguageCode)
			if strings.Contains(searchable, query) {
				filtered = append(filtered, item)
			}
		}
		items = filtered
	}

	httpx.OK(c, gin.H{"versions": items})
}

func (h Handler) Download(c *gin.Context) {
	versionID := strings.TrimSpace(c.Param("id"))
	path := sampleFilePath(versionID)
	if path == "" {
		httpx.Error(c, http.StatusNotFound, "bible_version_not_found", "bible version download not found")
		return
	}

	if _, err := os.Stat(path); err != nil {
		httpx.Error(c, http.StatusNotFound, "bible_version_not_found", "bible version download not found")
		return
	}

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="`+versionID+`_vpl.zip"`)
	c.File(path)
}

func (h Handler) RecordInstall(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var payload struct {
		Provider     string `json:"provider"`
		VersionID    string `json:"versionId"`
		LanguageCode string `json:"languageCode"`
		LanguageName string `json:"languageName"`
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
		Status       string `json:"status"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid_json", "invalid bible install payload")
		return
	}

	status := strings.TrimSpace(strings.ToLower(payload.Status))
	if status == "" {
		status = "installed"
	}
	if status != "installed" && status != "removed" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "valid install status is required")
		return
	}

	if strings.TrimSpace(payload.VersionID) == "" || strings.TrimSpace(payload.Name) == "" {
		httpx.Error(c, http.StatusBadRequest, "invalid_input", "version id and name are required")
		return
	}

	_, err := h.db.Exec(
		c.Request.Context(),
		`
			INSERT INTO bible_version_installs (
				id,
				user_id,
				provider,
				version_id,
				language_code,
				language_name,
				name,
				abbreviation,
				status
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (user_id, provider, version_id)
			DO UPDATE SET
				language_code = EXCLUDED.language_code,
				language_name = EXCLUDED.language_name,
				name = EXCLUDED.name,
				abbreviation = EXCLUDED.abbreviation,
				status = EXCLUDED.status,
				updated_at = NOW(),
				installed_at = CASE WHEN EXCLUDED.status = 'installed' THEN NOW() ELSE bible_version_installs.installed_at END
		`,
		"binst-"+strconv.FormatInt(time.Now().UnixNano(), 36),
		userID,
		firstNonEmpty(payload.Provider, "eBible"),
		strings.TrimSpace(payload.VersionID),
		strings.TrimSpace(payload.LanguageCode),
		strings.TrimSpace(payload.LanguageName),
		strings.TrimSpace(payload.Name),
		strings.TrimSpace(payload.Abbreviation),
		status,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "bible_install_failed", "failed to record bible install")
		return
	}

	httpx.OK(c, gin.H{"ok": true})
}

func (h Handler) ListInstalled(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	rows, err := h.db.Query(
		c.Request.Context(),
		`
			SELECT provider, version_id, language_code, language_name, name, abbreviation, status, installed_at
			FROM bible_version_installs
			WHERE user_id = $1
			ORDER BY installed_at DESC
		`,
		userID,
	)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "bible_install_list_failed", "failed to load installed bible versions")
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var provider, versionID, languageCode, languageName, name, abbreviation, status string
		var installedAt time.Time
		if err := rows.Scan(&provider, &versionID, &languageCode, &languageName, &name, &abbreviation, &status, &installedAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, "bible_install_list_failed", "failed to load installed bible versions")
			return
		}

		items = append(items, gin.H{
			"provider":     provider,
			"versionId":    versionID,
			"languageCode": languageCode,
			"languageName": languageName,
			"name":         name,
			"abbreviation": abbreviation,
			"status":       status,
			"installedAt":  installedAt.UTC().Format(time.RFC3339),
		})
	}

	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "bible_install_list_failed", "failed to load installed bible versions")
		return
	}

	httpx.OK(c, gin.H{"installs": items})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (v Version) MarshalJSON() ([]byte, error) {
	type alias Version
	item := alias(v)
	if item.FallbackDownloadURL != "" {
		if parsed, err := url.Parse(item.FallbackDownloadURL); err == nil && parsed.Scheme == "" {
			item.FallbackDownloadURL = item.FallbackDownloadURL
		}
	}
	return json.Marshal(item)
}
