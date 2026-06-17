package apibible

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
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

type apiBibleBook struct {
	ID           string `json:"id"`
	BibleID      string `json:"bibleId"`
	Abbreviation string `json:"abbreviation"`
	Name         string `json:"name"`
	NameLong     string `json:"nameLong"`
}

type apiBibleBooksResponse struct {
	Data []apiBibleBook `json:"data"`
}

type apiBibleChapter struct {
	ID        string `json:"id"`
	BibleID   string `json:"bibleId"`
	BookID    string `json:"bookId"`
	Number    string `json:"number"`
	Reference string `json:"reference"`
}

type apiBibleChaptersResponse struct {
	Data []apiBibleChapter `json:"data"`
}

type apiBibleChapterContent struct {
	ID         string `json:"id"`
	BibleID    string `json:"bibleId"`
	Number     string `json:"number"`
	BookID     string `json:"bookId"`
	Reference  string `json:"reference"`
	Content    string `json:"content"`
	VerseCount int    `json:"verseCount"`
}

type apiBibleChapterContentResponse struct {
	Data apiBibleChapterContent `json:"data"`
}

type parsedVerse struct {
	Number int
	Text   string
}

var verseMarkerPattern = regexp.MustCompile(`\[(\d+)\]`)

type exportCacheEntry struct {
	Body          string
	Chapters      int
	Verses        int
	FileName      string
	ContentLength int
}

var exportCache = struct {
	sync.RWMutex
	items map[string]exportCacheEntry
}{
	items: make(map[string]exportCacheEntry),
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

func cleanVerseText(value string) string {
	value = strings.ReplaceAll(value, "\n", " ")
	value = strings.ReplaceAll(value, "\r", " ")
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func parseChapterVerses(content string) []parsedVerse {
	matches := verseMarkerPattern.FindAllStringSubmatchIndex(content, -1)
	verses := make([]parsedVerse, 0, len(matches))

	for index, match := range matches {
		if len(match) < 4 {
			continue
		}

		numberRaw := content[match[2]:match[3]]
		number, err := strconv.Atoi(strings.TrimSpace(numberRaw))
		if err != nil || number <= 0 {
			continue
		}

		textStart := match[1]
		textEnd := len(content)

		if index+1 < len(matches) {
			textEnd = matches[index+1][0]
		}

		if textEnd < textStart {
			continue
		}

		text := cleanVerseText(content[textStart:textEnd])
		if text == "" {
			continue
		}

		verses = append(verses, parsedVerse{
			Number: number,
			Text:   text,
		})
	}

	return verses
}

func safeExportFileName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "api_bible_export_vpl.txt"
	}

	var out strings.Builder
	for _, ch := range value {
		if ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9' || ch == '-' || ch == '_' {
			out.WriteRune(ch)
		} else {
			out.WriteRune('_')
		}
	}

	clean := strings.Trim(out.String(), "_")
	if clean == "" {
		clean = "api_bible_export"
	}

	return clean + "_vpl.txt"
}

func (h Handler) fetchBooks(c *gin.Context, bibleID string) ([]apiBibleBook, bool) {
	var response apiBibleBooksResponse
	path := "/bibles/" + url.PathEscape(bibleID) + "/books"

	if !h.getJSON(c, path, nil, &response) {
		return nil, false
	}

	return response.Data, true
}

func (h Handler) fetchChapters(c *gin.Context, bibleID string, bookID string) ([]apiBibleChapter, bool) {
	var response apiBibleChaptersResponse
	path := "/bibles/" + url.PathEscape(bibleID) + "/books/" + url.PathEscape(bookID) + "/chapters"

	if !h.getJSON(c, path, nil, &response) {
		return nil, false
	}

	return response.Data, true
}

func (h Handler) fetchChapterContent(c *gin.Context, bibleID string, chapterID string) (apiBibleChapterContent, bool) {
	params := url.Values{}
	params.Set("content-type", "text")
	params.Set("include-notes", "false")
	params.Set("include-titles", "false")
	params.Set("include-chapter-numbers", "false")
	params.Set("include-verse-numbers", "true")

	var response apiBibleChapterContentResponse
	path := "/bibles/" + url.PathEscape(bibleID) + "/chapters/" + url.PathEscape(chapterID)

	if !h.getJSON(c, path, params, &response) {
		return apiBibleChapterContent{}, false
	}

	return response.Data, true
}

func numericChapterNumber(chapter apiBibleChapter) (int, bool) {
	number, err := strconv.Atoi(strings.TrimSpace(chapter.Number))
	if err != nil || number <= 0 {
		return 0, false
	}

	return number, true
}

func writeExportResponse(c *gin.Context, entry exportCacheEntry, cacheStatus string) {
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+entry.FileName+`"`)
	c.Header("Content-Length", strconv.Itoa(entry.ContentLength))
	c.Header("X-Bible-Export-Chapters", strconv.Itoa(entry.Chapters))
	c.Header("X-Bible-Export-Verses", strconv.Itoa(entry.Verses))
	c.Header("X-Bible-Export-Cache", cacheStatus)
	c.String(http.StatusOK, entry.Body)
}

func (h Handler) ExportVPL(c *gin.Context) {
	bibleID := strings.TrimSpace(c.Param("bibleId"))
	if bibleID == "" {
		httpx.Error(c, http.StatusBadRequest, "api_bible_id_required", "API.Bible bible id is required")
		return
	}

	bookFilter := strings.ToUpper(strings.TrimSpace(c.Query("bookId")))
	cacheKey := bibleID + "|" + bookFilter

	exportCache.RLock()
	cached, found := exportCache.items[cacheKey]
	exportCache.RUnlock()

	if found {
		writeExportResponse(c, cached, "hit")
		return
	}

	books, ok := h.fetchBooks(c, bibleID)
	if !ok {
		return
	}

	var buffer bytes.Buffer
	totalVerses := 0
	totalChapters := 0

	for _, book := range books {
		bookCode := strings.ToUpper(strings.TrimSpace(book.ID))
		if bookCode == "" {
			continue
		}

		if bookFilter != "" && bookCode != bookFilter {
			continue
		}

		chapters, ok := h.fetchChapters(c, bibleID, bookCode)
		if !ok {
			return
		}

		for _, chapter := range chapters {
			chapterNumber, numeric := numericChapterNumber(chapter)
			if !numeric {
				continue
			}

			content, ok := h.fetchChapterContent(c, bibleID, chapter.ID)
			if !ok {
				return
			}

			verses := parseChapterVerses(content.Content)
			if len(verses) == 0 {
				continue
			}

			for _, verse := range verses {
				buffer.WriteString(bookCode)
				buffer.WriteByte(' ')
				buffer.WriteString(strconv.Itoa(chapterNumber))
				buffer.WriteByte(':')
				buffer.WriteString(strconv.Itoa(verse.Number))
				buffer.WriteByte(' ')
				buffer.WriteString(verse.Text)
				buffer.WriteByte('\n')
				totalVerses++
			}

			totalChapters++
		}
	}

	if totalVerses == 0 {
		httpx.Error(c, http.StatusNotFound, "api_bible_export_empty", "No exportable verses were found for this API.Bible version")
		return
	}

	body := buffer.String()
	entry := exportCacheEntry{
		Body:          body,
		Chapters:      totalChapters,
		Verses:        totalVerses,
		FileName:      safeExportFileName("api_bible_" + bibleID),
		ContentLength: len([]byte(body)),
	}

	exportCache.Lock()
	exportCache.items[cacheKey] = entry
	exportCache.Unlock()

	writeExportResponse(c, entry, "miss")
}
