// Package books publishes the ministry's books, journals and materials.
// Files are encrypted on this server before they go to storage, so the
// stored copy is useless on its own; readers get the decrypted file only
// through this server, and only if the item is free or they own it.
package books

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/permissions"
)

const maxFileBytes = 150 << 20

var kinds = map[string]bool{"book": true, "journal": true, "devotional": true, "study": true, "magazine": true}

type Handler struct {
	db         *pgxpool.Pool
	perms      permissions.Checker
	key        []byte
	bucket     string
	publicBase string
	client     *s3.Client
}

func NewHandler(db *pgxpool.Pool, perms permissions.Checker) Handler {
	h := Handler{db: db, perms: perms}
	if raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(os.Getenv("LIBRARY_ENCRYPTION_KEY"))); err == nil && len(raw) == 32 {
		h.key = raw
	}
	endpoint := strings.TrimRight(os.Getenv("R2_ENDPOINT"), "/")
	if endpoint == "" && os.Getenv("R2_ACCOUNT_ID") != "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", strings.TrimSpace(os.Getenv("R2_ACCOUNT_ID")))
	}
	h.bucket = strings.TrimSpace(firstNonEmpty(os.Getenv("R2_SERMONS_BUCKET"), os.Getenv("R2_BUCKET")))
	h.publicBase = strings.TrimRight(firstNonEmpty(os.Getenv("R2_SERMONS_PUBLIC_BASE_URL"), os.Getenv("R2_PUBLIC_BASE_URL")), "/")
	if endpoint != "" && h.bucket != "" {
		cfg, err := awsconfig.LoadDefaultConfig(context.Background(), awsconfig.WithRegion("auto"),
			awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(strings.TrimSpace(os.Getenv("R2_ACCESS_KEY_ID")), strings.TrimSpace(os.Getenv("R2_SECRET_ACCESS_KEY")), "")))
		if err == nil {
			h.client = s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(endpoint); o.UsePathStyle = true })
		}
	}
	return h
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func (h Handler) ready() bool { return h.client != nil && len(h.key) == 32 }

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (h Handler) seal(plain []byte) ([]byte, error) {
	block, err := aes.NewCipher(h.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plain, nil), nil
}

func (h Handler) open(sealed []byte) ([]byte, error) {
	block, err := aes.NewCipher(h.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(sealed) < gcm.NonceSize() {
		return nil, errors.New("file too short")
	}
	return gcm.Open(nil, sealed[:gcm.NonceSize()], sealed[gcm.NonceSize():], nil)
}

type Item struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Author        string    `json:"author"`
	Category      string    `json:"category"`
	Kind          string    `json:"kind"`
	CoverURL      string    `json:"coverUrl"`
	Price         int       `json:"price"`
	FileSizeBytes int64     `json:"fileSizeBytes"`
	PublishedAt   time.Time `json:"publishedAt"`
	IsPublished   bool      `json:"isPublished"`
	// For the signed-in member:
	Owned   bool `json:"owned"`
	Pending bool `json:"pending"`
	CanEdit bool `json:"canEdit"`
	// Record keeping, shown to whoever manages the book.
	PublishedBy   string `json:"publishedBy,omitempty"`
	PublisherName string `json:"publisherName,omitempty"`
	Sales         int    `json:"sales,omitempty"`
}

const itemColumns = `
	l.id, l.title, l.description, l.author, l.category, l.kind, l.cover_url, l.price, l.file_size_bytes, l.published_at, l.is_published,
	EXISTS (SELECT 1 FROM giving_transactions g WHERE g.item_id = l.id AND g.user_id::text = $1 AND g.status = 'success'),
	EXISTS (SELECT 1 FROM giving_transactions g WHERE g.item_id = l.id AND g.user_id::text = $1 AND g.status = 'awaiting_verification'),
	COALESCE(l.published_by::text, ''), COALESCE((SELECT u.name FROM users u WHERE u.id = l.published_by), ''),
	(SELECT COUNT(*) FROM giving_transactions g WHERE g.item_id = l.id AND g.status = 'success')`

func scanItem(row interface{ Scan(...any) error }) (Item, error) {
	var it Item
	err := row.Scan(&it.ID, &it.Title, &it.Description, &it.Author, &it.Category, &it.Kind, &it.CoverURL, &it.Price, &it.FileSizeBytes, &it.PublishedAt, &it.IsPublished, &it.Owned, &it.Pending, &it.PublishedBy, &it.PublisherName, &it.Sales)
	return it, err
}

// manages: admins manage every book; a publisher manages the books they
// published, for as long as they keep the publishing permission.
func (h Handler) manages(ctx context.Context, userID, publishedBy string, admin bool) bool {
	if userID == "" {
		return false
	}
	return admin || (publishedBy == userID && h.perms.Has(ctx, userID, permissions.BooksPublish))
}

// redact hides the record-keeping fields from those who don't manage the book.
func redact(it *Item) {
	if !it.CanEdit {
		it.PublishedBy, it.PublisherName, it.Sales = "", "", 0
	}
}

// GET /library: the shelf. Hidden items show only to those who manage them.
func (h Handler) List(c *gin.Context) {
	userID, _ := auth.UserIDFromContext(c)
	ctx := c.Request.Context()
	canPublish := userID != "" && h.perms.Has(ctx, userID, permissions.BooksPublish)
	admin := userID != "" && h.perms.IsAdmin(ctx, userID)
	rows, err := h.db.Query(ctx, `SELECT `+itemColumns+` FROM library_items l
		WHERE l.is_published = TRUE OR $2 OR ($3 AND l.published_by::text = $1)
		ORDER BY l.is_featured DESC, l.published_at DESC LIMIT 300`, userID, admin, canPublish)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load the library"})
		return
	}
	defer rows.Close()
	items := make([]Item, 0)
	for rows.Next() {
		if it, err := scanItem(rows); err == nil {
			it.CanEdit = admin || (canPublish && it.PublishedBy == userID)
			redact(&it)
			items = append(items, it)
		}
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "canPublish": canPublish})
}

// GET /library/:id/file: the readable file. A paid book opens only for
// members who have paid (confirmed by finance), its publisher and admins.
func (h Handler) File(c *gin.Context) {
	userID, _ := auth.UserIDFromContext(c)
	ctx := c.Request.Context()
	var price int
	var fileKey, fileURL, publishedBy string
	var owned, published bool
	err := h.db.QueryRow(ctx, `SELECT price, file_key, file_url, is_published, COALESCE(published_by::text, ''),
		EXISTS (SELECT 1 FROM giving_transactions g WHERE g.item_id = l.id AND g.user_id::text = $2 AND g.status = 'success')
		FROM library_items l WHERE id = $1`, c.Param("id"), userID).Scan(&price, &fileKey, &fileURL, &published, &publishedBy, &owned)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found"})
		return
	}
	manager := h.manages(ctx, userID, publishedBy, userID != "" && h.perms.IsAdmin(ctx, userID))
	if !published && !manager {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found"})
		return
	}
	if price > 0 && !owned && !manager {
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Sign in to read this"})
		} else {
			c.JSON(http.StatusPaymentRequired, gin.H{"message": "Get this book to read it"})
		}
		return
	}
	c.Header("Cache-Control", "private, no-store")
	c.Header("Content-Disposition", "inline")
	c.Header("Content-Type", "application/pdf")
	if fileKey == "" {
		// Older items saved as a plain link.
		resp, err := http.Get(fileURL)
		if err != nil || resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusBadGateway, gin.H{"message": "File unavailable"})
			return
		}
		defer resp.Body.Close()
		c.DataFromReader(http.StatusOK, resp.ContentLength, "application/pdf", resp.Body, nil)
		return
	}
	if !h.ready() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Library storage is not configured"})
		return
	}
	obj, err := h.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(h.bucket), Key: aws.String(fileKey)})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "File unavailable"})
		return
	}
	defer obj.Body.Close()
	sealed, err := io.ReadAll(io.LimitReader(obj.Body, maxFileBytes+1024))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "File unavailable"})
		return
	}
	plain, err := h.open(sealed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "File could not be opened"})
		return
	}
	c.Data(http.StatusOK, "application/pdf", plain)
}

func (h Handler) put(ctx context.Context, key, contentType string, body []byte) error {
	_, err := h.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(h.bucket), Key: aws.String(key), Body: bytes.NewReader(body),
		ContentType: aws.String(contentType), ContentLength: aws.Int64(int64(len(body))),
	})
	return err
}

func readPart(c *gin.Context, field string, limit int64) ([]byte, string, error) {
	file, header, err := c.Request.FormFile(field)
	if err != nil {
		return nil, "", err
	}
	defer file.Close()
	if header.Size > limit {
		return nil, "", fmt.Errorf("%s is too large", field)
	}
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	return data, strings.ToLower(path.Ext(header.Filename)), err
}

func formPrice(v string) (int, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 || n > 1_000_000 {
		return 0, errors.New("price must be 0 (free) or a whole number of shillings")
	}
	return n, nil
}

// POST /library (publishers), multipart: title, description, author,
// category, kind, price, file (PDF), cover (JPG/PNG/WebP, optional).
func (h Handler) Publish(c *gin.Context) {
	if !h.ready() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Library storage is not configured"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFileBytes+20<<20)
	title := strings.TrimSpace(c.PostForm("title"))
	if title == "" || len(title) > 160 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Give the book a title"})
		return
	}
	price, err := formPrice(c.PostForm("price"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	kind := strings.ToLower(strings.TrimSpace(c.PostForm("kind")))
	if !kinds[kind] {
		kind = "book"
	}
	pdf, ext, err := readPart(c, "file", maxFileBytes)
	if err != nil || ext != ".pdf" || !bytes.HasPrefix(pdf, []byte("%PDF")) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Choose a PDF file (up to 150 MB)"})
		return
	}
	ctx := c.Request.Context()
	sealed, err := h.seal(pdf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not secure the file"})
		return
	}
	fileKey := "books/files/" + randomHex(16) + ".bin"
	if err := h.put(ctx, fileKey, "application/octet-stream", sealed); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "Could not store the file"})
		return
	}
	coverURL := ""
	if cover, cext, err := readPart(c, "cover", 10<<20); err == nil && len(cover) > 0 {
		types := map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
		if ct, ok := types[cext]; ok {
			key := "books/covers/" + randomHex(10) + cext
			if h.put(ctx, key, ct, cover) == nil {
				coverURL = h.publicBase + "/" + key
			}
		}
	}
	userID, _ := auth.UserIDFromContext(c)
	id := "book-" + randomHex(6)
	_, err = h.db.Exec(ctx, `INSERT INTO library_items (id, title, description, author, category, cover_url, file_url, file_type, file_size_bytes, price, kind, file_key, published_by)
		VALUES ($1, $2, $3, $4, $5, $6, '', 'pdf', $7, $8, $9, $10, $11)`,
		id, title, strings.TrimSpace(c.PostForm("description")), strings.TrimSpace(c.PostForm("author")), strings.TrimSpace(c.PostForm("category")),
		coverURL, len(pdf), price, kind, fileKey, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not save the book"})
		return
	}
	item, _ := scanItem(h.db.QueryRow(ctx, `SELECT `+itemColumns+` FROM library_items l WHERE l.id = $2`, userID, id))
	item.CanEdit = true
	c.JSON(http.StatusCreated, gin.H{"item": item})
}

// PATCH /library/:id (publishers): title, description, price, published.
func (h Handler) Update(c *gin.Context) {
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Author      *string `json:"author"`
		Category    *string `json:"category"`
		Price       *int    `json:"price"`
		IsPublished *bool   `json:"isPublished"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.Price != nil && (*req.Price < 0 || *req.Price > 1_000_000)) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid changes"})
		return
	}
	userID, _ := auth.UserIDFromContext(c)
	ctx := c.Request.Context()
	var publishedBy string
	if err := h.db.QueryRow(ctx, `SELECT COALESCE(published_by::text, '') FROM library_items WHERE id = $1`, c.Param("id")).Scan(&publishedBy); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found"})
		return
	}
	if !h.manages(ctx, userID, publishedBy, h.perms.IsAdmin(ctx, userID)) {
		c.JSON(http.StatusForbidden, gin.H{"message": "Only the publisher of this book or an admin can change it"})
		return
	}
	tag, err := h.db.Exec(ctx, `UPDATE library_items SET
		title = COALESCE($2, title), description = COALESCE($3, description), author = COALESCE($4, author),
		category = COALESCE($5, category), price = COALESCE($6, price), is_published = COALESCE($7, is_published), updated_at = NOW()
		WHERE id = $1`, c.Param("id"), req.Title, req.Description, req.Author, req.Category, req.Price, req.IsPublished)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
