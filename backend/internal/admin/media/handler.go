package media

import (
	"bytes"
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ariga/shekinah-backend/internal/httpx"
)

const (
	maxUploadBytes = 500 << 20 // 500MB
	uploadDir      = "uploads/media"
	publicPrefix   = "/uploads/media"
)

type Handler struct {
	client *http.Client
}

type cloudinaryUploadResponse struct {
	SecureURL        string `json:"secure_url"`
	URL              string `json:"url"`
	PublicID         string `json:"public_id"`
	OriginalFilename string `json:"original_filename"`
	ResourceType     string `json:"resource_type"`
	Format           string `json:"format"`
	Bytes            int64  `json:"bytes"`
}

func NewHandler() Handler {
	return Handler{
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (h Handler) Upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes)

	kind := strings.ToLower(strings.TrimSpace(c.PostForm("kind")))
	if kind == "" {
		httpx.Error(c, http.StatusBadRequest, "missing_kind", "kind is required")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "missing_file", "file is required")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if err := validateUpload(kind, ext); err != nil {
		httpx.Error(c, http.StatusBadRequest, "unsupported_file_type", err.Error())
		return
	}

	if cloudinaryConfigured() {
		h.uploadCloudinary(c, kind, file, header, ext)
		return
	}

	if productionMediaRequiresCloudinary() {
		httpx.Error(
			c,
			http.StatusServiceUnavailable,
			"cloudinary_required",
			"media uploads require Cloudinary in production",
		)
		return
	}

	h.uploadLocal(c, kind, file, ext)
}

func (h Handler) uploadLocal(c *gin.Context, kind string, file multipart.File, ext string) {
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("create upload dir failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "upload_dir_failed", "failed to prepare upload directory")
		return
	}

	name, err := randomFileName(ext)
	if err != nil {
		log.Printf("random filename failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "upload_name_failed", "failed to create upload filename")
		return
	}

	targetPath := filepath.Join(uploadDir, name)

	dst, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0644)
	if err != nil {
		log.Printf("create upload file failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "upload_create_failed", "failed to create upload file")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		log.Printf("write upload file failed: %v", err)
		_ = os.Remove(targetPath)
		httpx.Error(c, http.StatusInternalServerError, "upload_write_failed", "failed to save upload file")
		return
	}

	publicPath := publicPrefix + "/" + name

	httpx.OK(c, gin.H{
		"media": gin.H{
			"provider": "local",
			"kind":     kind,
			"path":     publicPath,
			"url":      absoluteURL(c, publicPath),
			"name":     name,
			"size":     written,
		},
	})
}

func (h Handler) uploadCloudinary(c *gin.Context, kind string, file multipart.File, header *multipart.FileHeader, ext string) {
	cloudName := env("CLOUDINARY_CLOUD_NAME")
	apiKey := env("CLOUDINARY_API_KEY")
	apiSecret := env("CLOUDINARY_API_SECRET")

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	folder := "shekinah/" + kind

	signature := signCloudinaryParams(
		map[string]string{
			"folder":    folder,
			"timestamp": timestamp,
		},
		apiSecret,
	)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	fields := map[string]string{
		"api_key":   apiKey,
		"timestamp": timestamp,
		"folder":    folder,
		"signature": signature,
	}

	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary payload failed: %w", err))
			return
		}
	}

	part, err := writer.CreateFormFile("file", header.Filename)
	if err != nil {
		h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary file failed: %w", err))
		return
	}

	if _, err := io.Copy(part, file); err != nil {
		h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary copy failed: %w", err))
		return
	}

	if err := writer.Close(); err != nil {
		h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary close failed: %w", err))
		return
	}

	endpoint := fmt.Sprintf(
		"https://api.cloudinary.com/v1_1/%s/auto/upload",
		cloudName,
	)

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, endpoint, &body)
	if err != nil {
		h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary request failed: %w", err))
		return
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := h.client.Do(req)
	if err != nil {
		log.Printf("cloudinary upload failed: %v", err)
		h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary upload failed: %w", err))
		return
	}
	defer resp.Body.Close()

	var payload cloudinaryUploadResponse
	raw, _ := io.ReadAll(resp.Body)

	if err := json.Unmarshal(raw, &payload); err != nil {
		log.Printf("cloudinary invalid response: %s", string(raw))
		h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary response invalid: %s", string(raw)))
		return
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("cloudinary rejected upload: %s", string(raw))
		h.fallbackToLocal(c, kind, file, ext, fmt.Errorf("cloudinary rejected upload: %s", string(raw)))
		return
	}

	url := payload.SecureURL
	if url == "" {
		url = payload.URL
	}

	if url == "" {
		h.fallbackToLocal(c, kind, file, ext, errors.New("cloudinary upload did not return a URL"))
		return
	}

	httpx.OK(c, gin.H{
		"media": gin.H{
			"provider":     "cloudinary",
			"kind":         kind,
			"path":         url,
			"url":          url,
			"name":         payload.PublicID,
			"size":         payload.Bytes,
			"resourceType": payload.ResourceType,
			"format":       payload.Format,
		},
	})
}

func (h Handler) fallbackToLocal(c *gin.Context, kind string, file multipart.File, ext string, reason error) {
	if productionMediaRequiresCloudinary() {
		log.Printf("cloudinary upload failed in production: %v", reason)
		httpx.Error(
			c,
			http.StatusBadGateway,
			"cloudinary_upload_failed",
			"Cloudinary upload failed; media was not saved locally in production",
		)
		return
	}

	log.Printf("cloudinary fallback to local upload: %v", reason)
	if seeker, ok := file.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			log.Printf("rewind upload file failed: %v", err)
		}
	}
	h.uploadLocal(c, kind, file, ext)
}

func validateUpload(kind string, ext string) error {
	video := map[string]bool{
		".mp4":  true,
		".mov":  true,
		".m4v":  true,
		".webm": true,
	}

	audio := map[string]bool{
		".mp3": true,
		".m4a": true,
		".aac": true,
		".wav": true,
		".ogg": true,
	}

	image := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".webp": true,
	}

	document := map[string]bool{
		".pdf": true,
	}

	switch kind {
	case "video":
		if video[ext] {
			return nil
		}
		return errors.New("video uploads must be mp4, mov, m4v, or webm")
	case "audio":
		if audio[ext] {
			return nil
		}
		return errors.New("audio uploads must be mp3, m4a, aac, wav, or ogg")
	case "image":
		if image[ext] {
			return nil
		}
		return errors.New("image uploads must be jpg, jpeg, png, or webp")
	case "document":
		if document[ext] {
			return nil
		}
		return errors.New("document uploads must be pdf")
	default:
		return errors.New("kind must be video, audio, image, or document")
	}
}

func randomFileName(ext string) (string, error) {
	buf := make([]byte, 16)

	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	return hex.EncodeToString(buf) + ext, nil
}

func absoluteURL(c *gin.Context, path string) string {
	proto := c.GetHeader("X-Forwarded-Proto")
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}

	host := c.Request.Host
	return fmt.Sprintf("%s://%s%s", proto, host, path)
}

func cloudinaryConfigured() bool {
	return env("CLOUDINARY_CLOUD_NAME") != "" &&
		env("CLOUDINARY_API_KEY") != "" &&
		env("CLOUDINARY_API_SECRET") != ""
}

func productionMediaRequiresCloudinary() bool {
	if strings.EqualFold(env("MEDIA_REQUIRE_CLOUDINARY"), "true") {
		return true
	}

	return strings.EqualFold(env("APP_ENV"), "production")
}

func signCloudinaryParams(params map[string]string, secret string) string {
	keys := make([]string, 0, len(params))

	for key := range params {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+params[key])
	}

	base := strings.Join(parts, "&") + secret
	sum := sha1.Sum([]byte(base))

	return hex.EncodeToString(sum[:])
}

func env(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}
