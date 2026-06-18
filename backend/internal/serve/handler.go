package serve

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/gin-gonic/gin"
)

const (
	maxServePDFBytes = 8 << 20 // 8MB
	serveUploadDir   = "uploads/serve-requests"
	servePublicPath  = "/uploads/serve-requests"
)

type Handler struct{}

func NewHandler() Handler {
	return Handler{}
}

func (h Handler) UploadRequestPDF(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxServePDFBytes)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "missing_file", "serve request PDF is required")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".pdf" {
		httpx.Error(c, http.StatusBadRequest, "unsupported_file_type", "only PDF files are supported")
		return
	}

	if header.Size > maxServePDFBytes {
		httpx.Error(c, http.StatusBadRequest, "file_too_large", "serve request PDF is too large")
		return
	}

	if err := os.MkdirAll(serveUploadDir, 0755); err != nil {
		log.Printf("create serve upload dir failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "upload_dir_failed", "failed to prepare serve request upload")
		return
	}

	name, err := randomPDFName()
	if err != nil {
		log.Printf("create serve pdf filename failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "upload_name_failed", "failed to create serve request filename")
		return
	}

	targetPath := filepath.Join(serveUploadDir, name)
	dst, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0644)
	if err != nil {
		log.Printf("create serve pdf file failed: %v", err)
		httpx.Error(c, http.StatusInternalServerError, "upload_create_failed", "failed to save serve request PDF")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		log.Printf("write serve pdf file failed: %v", err)
		_ = os.Remove(targetPath)
		httpx.Error(c, http.StatusInternalServerError, "upload_write_failed", "failed to write serve request PDF")
		return
	}

	publicPath := servePublicPath + "/" + name

	httpx.OK(c, gin.H{
		"pdf": gin.H{
			"path": publicPath,
			"url":  absoluteURL(c, publicPath),
			"name": name,
			"size": written,
		},
	})
}

func randomPDFName() (string, error) {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}

	return fmt.Sprintf("serve-request-%s-%s.pdf", time.Now().UTC().Format("20060102-150405"), hex.EncodeToString(b[:])), nil
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

	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}

	return strings.TrimRight(proto+"://"+host, "/") + path
}
