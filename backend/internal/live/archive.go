package live

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
)

// Archives are encrypted before R2 upload, including free recordings. Even a
// publicly readable bucket cannot expose paid recordings without this gateway.
type archiveStore struct {
	client *s3.Client
	bucket string
	key    [32]byte
}

func newArchiveStore(ctx context.Context) (*archiveStore, error) {
	endpoint := env("R2_ENDPOINT", "")
	if endpoint == "" && os.Getenv("R2_ACCOUNT_ID") != "" {
		endpoint = "https://" + os.Getenv("R2_ACCOUNT_ID") + ".r2.cloudflarestorage.com"
	}
	bucket := env("R2_SERMONS_BUCKET", env("R2_BUCKET", ""))
	secret := os.Getenv("LIBRARY_ENCRYPTION_KEY")
	if endpoint == "" || bucket == "" || secret == "" || os.Getenv("R2_ACCESS_KEY_ID") == "" || os.Getenv("R2_SECRET_ACCESS_KEY") == "" {
		return nil, fmt.Errorf("recording storage or encryption key is not configured")
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion("auto"), awsconfig.WithHTTPClient(&http.Client{Timeout: 10 * time.Minute}), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(os.Getenv("R2_ACCESS_KEY_ID"), os.Getenv("R2_SECRET_ACCESS_KEY"), "")))
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(endpoint); o.UsePathStyle = true })
	return &archiveStore{client, bucket, sha256.Sum256([]byte("shekinah-live-archive:" + secret))}, nil
}
func archiveDir() string   { return env("LIVE_RECORDINGS_DIR", "../.local/recordings") }
func archiveCache() string { return filepath.Join(archiveDir(), "cache") }

var replayMu sync.Mutex

func (h *Handler) prepareRecording(ctx context.Context, id string) error {
	body := []byte(fmt.Sprintf(`{"record":true,"recordPath":"/recordings/%s/%%path/%%Y-%%m-%%d_%%H-%%M-%%S-%%f","recordDeleteAfter":"0s"}`, id))
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, h.apiBase+"/v3/config/paths/patch/"+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := h.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("media server refused recording configuration (%d)", res.StatusCode)
	}
	return nil
}

func (h *Handler) ArchiveWatch(ctx context.Context) {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		h.pruneReplayCache()
		if err := h.archiveNext(ctx); err != nil {
			fmt.Printf("live archive: %v\n", err)
		}
	}
}
func (h *Handler) archiveNext(ctx context.Context) error {
	// Keep retries in PostgreSQL; a stopped worker can reclaim an expired lease.
	_, err := h.db.Exec(ctx, `INSERT INTO live_archives(session_id) SELECT id FROM live_sessions WHERE status='ended' AND started_at IS NOT NULL AND recording_expected AND transport='mediamtx' ON CONFLICT DO NOTHING`)
	if err != nil {
		return err
	}
	var id string
	err = h.db.QueryRow(ctx, `UPDATE live_archives SET status='processing', attempts=attempts+1, updated_at=NOW() WHERE session_id=(
 SELECT a.session_id FROM live_archives a JOIN live_sessions l ON l.id=a.session_id
 WHERE ((a.status IN ('pending','failed') AND a.retry_at<=NOW()) OR (a.status='processing' AND a.updated_at<NOW()-INTERVAL '30 minutes')) AND l.ended_at<NOW()-INTERVAL '15 seconds'
 ORDER BY a.retry_at LIMIT 1 FOR UPDATE OF a SKIP LOCKED) RETURNING session_id`).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil
		}
		return err
	}
	heartbeatCtx, stopHeartbeat := context.WithCancel(ctx)
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-heartbeatCtx.Done():
				return
			case <-ticker.C:
				_, _ = h.db.Exec(heartbeatCtx, `UPDATE live_archives SET updated_at=NOW() WHERE session_id=$1 AND status='processing'`, id)
			}
		}
	}()
	size, key, err := h.archive(ctx, id)
	stopHeartbeat()
	if err != nil {
		_, _ = h.db.Exec(ctx, `UPDATE live_archives SET status='failed',error=$2,retry_at=NOW()+LEAST(INTERVAL '1 hour', INTERVAL '30 seconds'*power(2,LEAST(attempts,7))),updated_at=NOW() WHERE session_id=$1`, id, err.Error())
		return err
	}
	_, err = h.db.Exec(ctx, `UPDATE live_archives SET status='ready',object_key=$2,size_bytes=$3,error='',updated_at=NOW() WHERE session_id=$1`, id, key, size)
	if err == nil {
		_ = os.RemoveAll(filepath.Join(archiveDir(), id))
	}
	return err
}
func (h *Handler) archive(ctx context.Context, id string) (int64, string, error) {
	store, err := newArchiveStore(ctx)
	if err != nil {
		return 0, "", err
	}
	files, err := filepath.Glob(filepath.Join(archiveDir(), id, path, "*.mp4"))
	if err != nil || len(files) == 0 {
		return 0, "", fmt.Errorf("waiting for recording segments")
	}
	sort.Strings(files)
	if err = os.MkdirAll(archiveCache(), 0700); err != nil {
		return 0, "", err
	}
	merged := filepath.Join(archiveCache(), id+".mp4")
	var list strings.Builder
	for _, f := range files {
		abs, _ := filepath.Abs(f)
		list.WriteString("file '" + strings.ReplaceAll(abs, "'", "'\\''") + "'\n")
	}
	manifest := filepath.Join(archiveCache(), id+".txt")
	if err = os.WriteFile(manifest, []byte(list.String()), 0600); err != nil {
		return 0, "", err
	}
	defer os.Remove(manifest)
	mergeCtx, cancel := context.WithTimeout(ctx, 20*time.Minute)
	defer cancel()
	output, err := exec.CommandContext(mergeCtx, "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", manifest, "-c", "copy", "-movflags", "+faststart", merged).CombinedOutput()
	if err != nil {
		return 0, "", fmt.Errorf("finalize recording: %w: %.400s", err, output)
	}
	info, err := os.Stat(merged)
	if err != nil {
		return 0, "", err
	}
	_ = os.Chmod(merged, 0600)
	sealed := merged + ".sealed"
	if err = sealArchive(merged, sealed, store.key); err != nil {
		return 0, "", err
	}
	defer os.Remove(sealed)
	f, err := os.Open(sealed)
	if err != nil {
		return 0, "", err
	}
	defer f.Close()
	stat, _ := f.Stat()
	key := "live-archives/" + id + ".enc"
	err = store.upload(ctx, f, key, stat.Size())
	return info.Size(), key, err
}

// Encrypt then MAC. A download is authenticated in full before a plaintext
// cache file is exposed through HTTP Range, and tampered objects are rejected.
func sealArchive(src, dst string, key [32]byte) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer out.Close()
	iv := make([]byte, aes.BlockSize)
	if _, err = rand.Read(iv); err != nil {
		return err
	}
	macKey := sha256.Sum256(append([]byte("archive-mac:"), key[:]...))
	mac := hmac.New(sha256.New, macKey[:])
	writer := io.MultiWriter(out, mac)
	if _, err = writer.Write(iv); err != nil {
		return err
	}
	block, _ := aes.NewCipher(key[:])
	if _, err = io.Copy(&cipher.StreamWriter{S: cipher.NewCTR(block, iv), W: writer}, in); err != nil {
		return err
	}
	_, err = out.Write(mac.Sum(nil))
	return err
}
func openArchive(src, dst string, key [32]byte) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	stat, err := in.Stat()
	if err != nil {
		return err
	}
	if stat.Size() < 48 {
		return fmt.Errorf("truncated recording")
	}
	macKey := sha256.Sum256(append([]byte("archive-mac:"), key[:]...))
	mac := hmac.New(sha256.New, macKey[:])
	if _, err = io.Copy(mac, io.LimitReader(in, stat.Size()-32)); err != nil {
		return err
	}
	tag := make([]byte, 32)
	if _, err = io.ReadFull(in, tag); err != nil {
		return err
	}
	if !hmac.Equal(mac.Sum(nil), tag) {
		return fmt.Errorf("recording authentication failed")
	}
	if _, err = in.Seek(0, io.SeekStart); err != nil {
		return err
	}
	iv := make([]byte, 16)
	if _, err = io.ReadFull(in, iv); err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer out.Close()
	block, _ := aes.NewCipher(key[:])
	_, err = io.Copy(out, &cipher.StreamReader{S: cipher.NewCTR(block, iv), R: io.LimitReader(in, stat.Size()-48)})
	return err
}
func (h *Handler) Replays(c *gin.Context) {
	user, _ := auth.UserIDFromContext(c)
	rows, err := h.db.Query(c.Request.Context(), `SELECT l.id,l.title,l.price,l.started_at,a.status,a.error FROM live_sessions l JOIN live_archives a ON a.session_id=l.id ORDER BY l.started_at DESC LIMIT 100`)
	if err != nil {
		c.JSON(500, gin.H{"message": "Could not load replays"})
		return
	}
	defer rows.Close()
	items := []gin.H{}
	for rows.Next() {
		var s Session
		var status, message string
		_ = rows.Scan(&s.ID, &s.Title, &s.Price, &s.StartedAt, &status, &message)
		access := h.canWatch(c.Request.Context(), &s, user)
		item := gin.H{"id": s.ID, "title": s.Title, "price": s.Price, "date": s.StartedAt, "status": status, "access": access, "mediaUrl": "/api/v1/live/replays/" + s.ID + "/file"}
		var direct bool
		_ = h.db.QueryRow(c.Request.Context(), `SELECT transport='r2' FROM live_sessions WHERE id=$1`, s.ID).Scan(&direct)
		if direct {
			item["mediaUrl"] = directPrefix + s.ID + "/index.m3u8"
		}
		if user != "" && h.staff != nil && h.staff(c.Request.Context(), user) {
			item["error"] = message
		}
		items = append(items, item)
	}
	c.JSON(200, gin.H{"items": items})
}
func (h *Handler) Replay(c *gin.Context) {
	ctx := c.Request.Context()
	var s Session
	var key string
	err := h.db.QueryRow(ctx, `SELECT l.id,l.price,a.object_key FROM live_sessions l JOIN live_archives a ON a.session_id=l.id WHERE l.id=$1 AND a.status='ready'`, c.Param("id")).Scan(&s.ID, &s.Price, &key)
	if err != nil {
		c.JSON(404, gin.H{"message": "Recording is not ready"})
		return
	}
	if strings.HasPrefix(key, "r2-hls/") {
		c.Params = append(c.Params, gin.Param{Key: "id", Value: s.ID})
		h.DirectPlaylist(c)
		return
	}
	user, _ := auth.UserIDFromContext(c)
	if !h.canWatch(ctx, &s, user) {
		c.JSON(402, gin.H{"message": "Get access to watch this replay"})
		return
	}
	c.Header("Cache-Control", "private, no-store")
	f := filepath.Join(archiveCache(), s.ID+".mp4")
	if err = h.restoreReplay(ctx, f, key); err != nil {
		c.JSON(503, gin.H{"message": "Recording temporarily unavailable"})
		return
	}
	_ = os.Chtimes(f, time.Now(), time.Now())
	http.ServeFile(c.Writer, c.Request, f)
}
func (h *Handler) restoreReplay(ctx context.Context, file, key string) error {
	replayMu.Lock()
	defer replayMu.Unlock()
	if stat, err := os.Stat(file); err == nil && stat.Size() > 0 {
		return nil
	}
	store, err := newArchiveStore(ctx)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(archiveCache(), 0700); err != nil {
		return err
	}
	obj, err := store.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key)})
	if err != nil {
		return err
	}
	defer obj.Body.Close()
	sealed := file + ".download"
	out, err := os.OpenFile(sealed, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, obj.Body)
	closeErr := out.Close()
	defer os.Remove(sealed)
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	temp := file + ".tmp"
	defer os.Remove(temp)
	if err = openArchive(sealed, temp, store.key); err != nil {
		return err
	}
	return os.Rename(temp, file)
}

// Cache eviction never removes durable R2 objects or unarchived source segments.
func (h *Handler) pruneReplayCache() {
	hours, _ := strconv.Atoi(env("LIVE_REPLAY_CACHE_HOURS", "48"))
	if hours < 1 {
		hours = 48
	}
	files, _ := filepath.Glob(filepath.Join(archiveCache(), "*.mp4"))
	type cached struct {
		name string
		size int64
		at   time.Time
	}
	items := []cached{}
	var total int64
	for _, file := range files {
		if stat, err := os.Stat(file); err == nil {
			items = append(items, cached{file, stat.Size(), stat.ModTime()})
			total += stat.Size()
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].at.Before(items[j].at) })
	const limit int64 = 2 * 1024 * 1024 * 1024
	for _, item := range items {
		age := time.Since(item.at)
		if age < time.Minute {
			continue
		}
		if age > time.Duration(hours)*time.Hour || total > limit {
			if os.Remove(item.name) == nil {
				total -= item.size
			}
		}
	}
}
