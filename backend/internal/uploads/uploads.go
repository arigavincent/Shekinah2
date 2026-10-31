// Package uploads stages bounded chunks privately. Offsets and ownership are
// durable, so either admin client can resume after network or process loss.
package uploads

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/permissions"
	"github.com/ariga/shekinah-backend/internal/sermonmedia"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"regexp"
)

const ChunkSize = 4 << 20

var validID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type Handler struct {
	db    *pgxpool.Pool
	perms permissions.Checker
	root  string
}

func New(db *pgxpool.Pool, perms permissions.Checker) Handler {
	root := os.Getenv("UPLOAD_STAGING_DIR")
	if root == "" {
		root = ".local/upload-staging"
	}
	_ = os.MkdirAll(root, 0700)
	return Handler{db, perms, root}
}

type Session struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	FileName    string `json:"fileName"`
	Size        int64  `json:"sizeBytes"`
	Offset      int64  `json:"offset"`
	ContentType string `json:"contentType"`
	Status      string `json:"status"`
	PublicURL   string `json:"publicUrl"`
}

func allowedType(kind, name string) (string, int64) {
	ext := strings.ToLower(filepath.Ext(name))
	if kind == "book" && ext == ".pdf" {
		return "application/pdf", 150 << 20
	}
	if kind == "image" {
		switch ext {
		case ".jpg", ".jpeg":
			return "image/jpeg", 10 << 20
		case ".png":
			return "image/png", 10 << 20
		case ".webp":
			return "image/webp", 10 << 20
		}
	}
	if kind == "video" {
		switch ext {
		case ".mp4", ".m4v":
			return "video/mp4", 5 << 30
		case ".mov":
			return "video/quicktime", 5 << 30
		case ".webm":
			return "video/webm", 5 << 30
		}
	}
	if kind == "audio" {
		switch ext {
		case ".mp3":
			return "audio/mpeg", 5 << 30
		case ".m4a":
			return "audio/mp4", 5 << 30
		case ".wav":
			return "audio/wav", 5 << 30
		case ".ogg":
			return "audio/ogg", 5 << 30
		case ".aac":
			return "audio/aac", 5 << 30
		}
	}
	return "", 0
}
func (h Handler) allowed(c *gin.Context, kind string) bool {
	u, _ := auth.UserIDFromContext(c)
	ctx := c.Request.Context()
	switch kind {
	case "book":
		return h.perms.Has(ctx, u, permissions.BooksPublish)
	case "audio", "video":
		return h.perms.Has(ctx, u, permissions.SermonsManage)
	case "image":
		return h.perms.Has(ctx, u, permissions.SermonsManage) || h.perms.Has(ctx, u, permissions.EventsManage) || h.perms.Has(ctx, u, permissions.BooksPublish) || h.perms.Has(ctx, u, permissions.ContentManage)
	}
	return false
}

type queryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (h Handler) load(c *gin.Context) (Session, error) { return h.loadFrom(c, h.db, true) }
func (h Handler) loadFrom(c *gin.Context, q queryer, checkPermission bool) (Session, error) {
	var s Session
	u, _ := auth.UserIDFromContext(c)
	e := q.QueryRow(c.Request.Context(), `SELECT id::text,kind,file_name,size_bytes,offset_bytes,content_type,status,public_url FROM upload_sessions WHERE id::text=$1 AND owner_id::text=$2`, c.Param("id"), u).Scan(&s.ID, &s.Kind, &s.FileName, &s.Size, &s.Offset, &s.ContentType, &s.Status, &s.PublicURL)
	if e == nil && checkPermission && !h.allowed(c, s.Kind) {
		return s, errors.New("permission removed")
	}
	return s, e
}
func (h Handler) Create(c *gin.Context) {
	var r struct {
		ID       string `json:"id"`
		Kind     string `json:"kind"`
		FileName string `json:"fileName"`
		Size     int64  `json:"sizeBytes"`
	}
	if c.ShouldBindJSON(&r) != nil {
		c.JSON(400, gin.H{"message": "Invalid upload"})
		return
	}
	id := strings.ToLower(r.ID)
	var e error
	if !validID.MatchString(id) {
		e = errors.New("invalid id")
	}
	ct, max := allowedType(r.Kind, r.FileName)
	if e != nil || ct == "" || r.Size <= 0 || r.Size > max {
		c.JSON(400, gin.H{"message": "Unsupported file or size. PDFs up to 150 MB; media up to 5 GB."})
		return
	}
	if !h.allowed(c, r.Kind) {
		c.JSON(403, gin.H{"message": "Publishing permission required"})
		return
	}
	u, _ := auth.UserIDFromContext(c)
	_, e = h.db.Exec(c.Request.Context(), `INSERT INTO upload_sessions(id,owner_id,kind,file_name,size_bytes,content_type) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, id, u, r.Kind, filepath.Base(r.FileName), r.Size, ct)
	if e != nil {
		c.JSON(500, gin.H{"message": "Could not start upload"})
		return
	}
	c.Params = append(c.Params, gin.Param{Key: "id", Value: id})
	s, e := h.load(c)
	if e != nil {
		c.JSON(409, gin.H{"message": "Upload identifier is already in use"})
		return
	}
	if s.Kind != r.Kind || s.FileName != filepath.Base(r.FileName) || s.Size != r.Size {
		c.JSON(409, gin.H{"message": "This upload belongs to a different file"})
		return
	}
	c.JSON(200, s)
}
func (h Handler) Get(c *gin.Context) {
	s, e := h.load(c)
	if e != nil {
		c.JSON(404, gin.H{"message": "Upload unavailable"})
		return
	}
	c.JSON(200, s)
}

// Serialize each file across processes using a transaction-scoped DB lock.
func (h Handler) lock(c *gin.Context) (pgx.Tx, error) {
	tx, e := h.db.Begin(c.Request.Context())
	if e != nil {
		return nil, e
	}
	_, e = tx.Exec(c.Request.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "upload:"+c.Param("id"))
	if e != nil {
		_ = tx.Rollback(c.Request.Context())
	}
	return tx, e
}
func (h Handler) Chunk(c *gin.Context) {
	s, e := h.load(c)
	if e != nil {
		c.JSON(404, gin.H{"message": "Upload unavailable"})
		return
	}
	tx, e := h.lock(c)
	if e != nil {
		c.Status(503)
		return
	}
	defer tx.Rollback(c.Request.Context())
	s, e = h.loadFrom(c, tx, false)
	if e != nil {
		c.JSON(404, gin.H{"message": "Upload unavailable"})
		return
	}
	offset, e := strconv.ParseInt(c.GetHeader("Upload-Offset"), 10, 64)
	if e != nil || offset != s.Offset || s.Status != "pending" {
		c.JSON(409, gin.H{"message": "Resume from the server offset", "offset": s.Offset})
		return
	}
	if c.Request.ContentLength <= 0 || c.Request.ContentLength > ChunkSize || s.Offset+c.Request.ContentLength > s.Size {
		c.JSON(400, gin.H{"message": "Invalid chunk length"})
		return
	}
	f, e := os.OpenFile(filepath.Join(h.root, s.ID), os.O_CREATE|os.O_RDWR, 0600)
	if e != nil {
		c.Status(507)
		return
	}
	defer f.Close()
	// A crash between fsync and DB commit is safe: discard bytes after committed offset.
	stat, e := f.Stat()
	if e != nil || stat.Size() < s.Offset {
		c.JSON(409, gin.H{"message": "Staged file was lost. Cancel and select the file again."})
		return
	}
	if e = f.Truncate(s.Offset); e == nil {
		_, e = f.Seek(s.Offset, io.SeekStart)
	}
	var n int64
	if e == nil {
		n, e = io.Copy(f, io.LimitReader(c.Request.Body, ChunkSize+1))
	}
	if e != nil || n != c.Request.ContentLength {
		c.JSON(400, gin.H{"message": "Chunk interrupted; resume to retry"})
		return
	}
	if e = f.Sync(); e != nil {
		c.Status(507)
		return
	}
	_, e = tx.Exec(c.Request.Context(), `UPDATE upload_sessions SET offset_bytes=$2,updated_at=NOW() WHERE id=$1`, s.ID, s.Offset+n)
	if e == nil {
		e = tx.Commit(c.Request.Context())
	}
	if e != nil {
		c.Status(503)
		return
	}
	c.JSON(200, gin.H{"offset": s.Offset + n})
}
func (h Handler) Finish(c *gin.Context) {
	s, e := h.load(c)
	if e != nil {
		c.JSON(404, gin.H{"message": "Upload unavailable"})
		return
	}
	tx, e := h.lock(c)
	if e != nil {
		c.Status(503)
		return
	}
	defer tx.Rollback(c.Request.Context())
	s, e = h.loadFrom(c, tx, false)
	if e != nil {
		c.JSON(404, gin.H{"message": "Upload unavailable"})
		return
	}
	if s.Status == "ready" {
		c.JSON(200, s)
		return
	}
	if s.Status != "pending" || s.Offset != s.Size {
		c.JSON(409, gin.H{"message": "Upload is incomplete"})
		return
	}
	probe, e := os.Open(filepath.Join(h.root, s.ID))
	if e != nil {
		c.JSON(409, gin.H{"message": "Staged file unavailable"})
		return
	}
	head := make([]byte, 512)
	n, _ := probe.Read(head)
	probe.Close()
	if !validMagic(s.ContentType, head[:n]) {
		c.JSON(400, gin.H{"message": "File contents do not match the selected file type"})
		return
	}
	if s.Kind != "book" {
		file, e := os.Open(filepath.Join(h.root, s.ID))
		if e != nil {
			c.Status(409)
			return
		}
		defer file.Close()
		signed, e := sermonmedia.NewR2PresignerFromEnv().PresignForKey(c.Request.Context(), sermonmedia.DirectUploadRequest{Kind: s.Kind, FileName: s.FileName, SizeBytes: s.Size}, "uploads/"+s.ID+strings.ToLower(filepath.Ext(s.FileName)))
		if e != nil {
			c.JSON(503, gin.H{"message": "Media storage is unavailable"})
			return
		}
		req, e := http.NewRequestWithContext(c.Request.Context(), "PUT", signed.UploadURL, file)
		if e != nil {
			c.Status(503)
			return
		}
		req.ContentLength = s.Size
		req.Header.Set("Content-Type", signed.ContentType)
		response, e := (&http.Client{Timeout: 30 * time.Minute}).Do(req)
		if e != nil {
			c.JSON(502, gin.H{"message": "Storage transfer interrupted; retry to finish"})
			return
		}
		response.Body.Close()
		if response.StatusCode >= 300 {
			c.JSON(502, gin.H{"message": "Storage rejected transfer; retry to finish"})
			return
		}
		s.PublicURL = signed.PublicURL
	}
	_, e = tx.Exec(c.Request.Context(), `UPDATE upload_sessions SET status='ready',public_url=$2,updated_at=NOW() WHERE id=$1`, s.ID, s.PublicURL)
	if e == nil {
		e = tx.Commit(c.Request.Context())
	}
	if e != nil {
		c.Status(503)
		return
	}
	s.Status = "ready"
	if s.Kind != "book" {
		_ = os.Remove(filepath.Join(h.root, s.ID))
	}
	c.JSON(200, s)
}
func (h Handler) Cancel(c *gin.Context) {
	s, e := h.load(c)
	if e != nil {
		c.JSON(404, gin.H{"message": "Upload unavailable"})
		return
	}
	tx, e := h.lock(c)
	if e != nil {
		c.Status(503)
		return
	}
	defer tx.Rollback(c.Request.Context())
	s, e = h.loadFrom(c, tx, false)
	if e != nil {
		c.Status(404)
		return
	}
	_, e = tx.Exec(c.Request.Context(), `UPDATE upload_sessions SET status='cancelled',updated_at=NOW() WHERE id=$1`, s.ID)
	if e == nil {
		e = tx.Commit(c.Request.Context())
	}
	if e != nil {
		c.Status(503)
		return
	}
	_ = os.Remove(filepath.Join(h.root, s.ID))
	c.JSON(200, gin.H{"ok": true})
}

// ReadBook never returns another publisher's staged file or a public storage URL.
func (h Handler) ReadBook(ctx context.Context, id, user string) ([]byte, error) {
	var size int64
	e := h.db.QueryRow(ctx, `SELECT size_bytes FROM upload_sessions WHERE id::text=$1 AND owner_id::text=$2 AND kind='book' AND status='ready'`, id, user).Scan(&size)
	if e != nil {
		return nil, e
	}
	f, e := os.Open(filepath.Join(h.root, id))
	if e != nil {
		return nil, e
	}
	defer f.Close()
	b, e := io.ReadAll(io.LimitReader(f, 150<<20+1))
	if int64(len(b)) != size {
		return nil, fmt.Errorf("incomplete PDF")
	}
	return b, e
}
func (h Handler) Cleanup(ctx context.Context) {
	rows, e := h.db.Query(ctx, `DELETE FROM upload_sessions WHERE updated_at<NOW()-INTERVAL '7 days' RETURNING id::text`)
	if e != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			_ = os.Remove(filepath.Join(h.root, id))
		}
	}
}
