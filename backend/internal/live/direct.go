package live

// Direct HLS publishing: the encoder PUTs immutable segments to private R2.
// The API never relays video bytes; PostgreSQL persists sequence, quota and replay
// state. Only acknowledged, contiguous objects are advertised to viewers.
import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/notifications"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const directPrefix = "/api/v1/live/direct/"
const segmentLimit int64 = 8 * 1024 * 1024

type directSegment struct {
	Sequence int     `json:"sequence"`
	Size     int64   `json:"size"`
	SHA256   string  `json:"sha256"`
	Duration float64 `json:"duration"`
}

func directMaxBytes() int64 {
	n, _ := strconv.ParseInt(os.Getenv("LIVE_R2_MAX_BYTES"), 10, 64)
	if n <= 0 || n > 5_000_000_000 {
		n = 5_000_000_000
	}
	return n
}
func (h *Handler) directOwner(c *gin.Context) (Session, string, bool) {
	var s Session
	var owner, format string
	var ended *time.Time
	err := h.db.QueryRow(c.Request.Context(), `SELECT id,price,broadcaster_id::text,segment_format,status,ended_at FROM live_sessions WHERE id=$1 AND transport='r2'`, c.Param("id")).Scan(&s.ID, &s.Price, &owner, &format, &s.Status, &ended)
	user, _ := auth.UserIDFromContext(c)
	if err != nil {
		c.JSON(404, gin.H{"message": "Broadcast not found"})
		return s, format, false
	}
	if owner != user {
		c.JSON(403, gin.H{"message": "Only this broadcaster can upload its recording"})
		return s, format, false
	}
	if ended != nil && time.Since(*ended) > 24*time.Hour {
		c.JSON(409, gin.H{"message": "The recording upload window has ended"})
		return s, format, false
	}
	return s, format, true
}
func (h *Handler) DirectPrepare(c *gin.Context) {
	s, format, ok := h.directOwner(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	var in directSegment
	if c.ShouldBindJSON(&in) != nil || !validSegment(in, format) {
		c.JSON(400, gin.H{"message": "Invalid video segment"})
		return
	}
	ctx := c.Request.Context()
	store, err := newArchiveStore(ctx)
	if err != nil {
		c.JSON(503, gin.H{"message": "Recording storage is unavailable"})
		return
	}
	tx, err := h.db.Begin(ctx)
	if err != nil {
		c.Status(503)
		return
	}
	defer tx.Rollback(ctx)
	// One global quota lock prevents parallel publishers allocating the same free bytes.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(73915002)`); err != nil {
		c.Status(503)
		return
	}
	var key, digest string
	var size int64
	var duration float64
	var ready bool
	err = tx.QueryRow(ctx, `SELECT object_key,sha256,size_bytes,duration,ready FROM live_segments WHERE session_id=$1 AND sequence=$2`, s.ID, in.Sequence).Scan(&key, &digest, &size, &duration, &ready)
	if errors.Is(err, pgx.ErrNoRows) {
		var total int64
		var expected int
		err = tx.QueryRow(ctx, `SELECT COALESCE(SUM(size_bytes),0) FROM live_segments`).Scan(&total)
		if err != nil {
			c.Status(503)
			return
		}
		if total+in.Size > directMaxBytes() {
			c.JSON(507, gin.H{"message": "Recording storage allowance reached. Remove recordings or free space before continuing."})
			return
		}
		if in.Sequence >= 0 {
			_ = tx.QueryRow(ctx, `SELECT COALESCE(MAX(sequence)+1,0) FROM live_segments WHERE session_id=$1 AND sequence>=0`, s.ID).Scan(&expected)
			if in.Sequence != expected {
				c.JSON(409, gin.H{"message": "Upload the preceding segment first", "nextSequence": expected})
				return
			}
		}
		ext := "ts"
		if format == "fmp4" {
			ext = "m4s"
		}
		if in.Sequence < 0 {
			ext = "mp4"
		}
		key = fmt.Sprintf("live-segments/%s/%06d-%s.%s", s.ID, in.Sequence, in.SHA256, ext)
		_, err = tx.Exec(ctx, `INSERT INTO live_segments(session_id,sequence,object_key,size_bytes,sha256,duration)VALUES($1,$2,$3,$4,$5,$6)`, s.ID, in.Sequence, key, in.Size, in.SHA256, in.Duration)
		if err != nil {
			c.Status(503)
			return
		}
	} else if err != nil {
		c.Status(503)
		return
	} else if digest != in.SHA256 || size != in.Size || math.Abs(duration-in.Duration) > 0.001 {
		c.JSON(409, gin.H{"message": "A different segment already occupies this position"})
		return
	}
	if err = tx.Commit(ctx); err != nil {
		c.Status(503)
		return
	}
	c.Header("Cache-Control", "private, no-store")
	if ready {
		c.JSON(200, gin.H{"ready": true})
		return
	}
	sum, _ := hex.DecodeString(in.SHA256)
	checksum := base64.StdEncoding.EncodeToString(sum)
	signed, err := s3.NewPresignClient(store.client).PresignPutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key), ContentLength: aws.Int64(in.Size), ChecksumSHA256: aws.String(checksum), IfNoneMatch: aws.String("*")}, func(o *s3.PresignOptions) { o.Expires = 5 * time.Minute })
	if err != nil {
		c.JSON(503, gin.H{"message": "Could not authorize video upload"})
		return
	}
	headers := map[string]string{}
	for name, values := range signed.SignedHeader {
		if !strings.EqualFold(name, "host") {
			headers[name] = strings.Join(values, ",")
		}
	}
	// Required even if a signer places the checksum in the query string.
	headers["If-None-Match"] = "*"
	c.JSON(200, gin.H{"ready": false, "url": signed.URL, "headers": headers, "expiresIn": 300})
}
func validSegment(in directSegment, format string) bool {
	_, e := hex.DecodeString(in.SHA256)
	return in.Sequence >= -1 && in.Sequence < 20000 && in.Size > 0 && in.Size <= segmentLimit && len(in.SHA256) == 64 && e == nil && in.SHA256 == strings.ToLower(in.SHA256) && !math.IsNaN(in.Duration) && !math.IsInf(in.Duration, 0) && ((in.Sequence == -1 && format == "fmp4" && in.Duration == 0 && in.Size <= 65536) || (in.Sequence >= 0 && in.Duration > 0 && in.Duration <= 30))
}
func (h *Handler) DirectCommit(c *gin.Context) {
	s, format, ok := h.directOwner(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	sequence, err := strconv.Atoi(c.Param("sequence"))
	if err != nil || sequence < -1 || sequence >= 20000 {
		c.Status(400)
		return
	}
	var key string
	var size int64
	var ready bool
	if h.db.QueryRow(ctx, `SELECT object_key,size_bytes,ready FROM live_segments WHERE session_id=$1 AND sequence=$2`, s.ID, sequence).Scan(&key, &size, &ready) != nil {
		c.Status(404)
		return
	}
	if !ready {
		store, e := newArchiveStore(ctx)
		if e != nil {
			c.Status(503)
			return
		}
		obj, e := store.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key), Range: aws.String("bytes=0-511")})
		if e != nil {
			c.JSON(409, gin.H{"message": "Video upload has not completed"})
			return
		}
		data, e := io.ReadAll(io.LimitReader(obj.Body, 513))
		obj.Body.Close()
		actual := aws.ToInt64(obj.ContentLength)
		if obj.ContentRange != nil {
			parts := strings.Split(*obj.ContentRange, "/")
			actual, _ = strconv.ParseInt(parts[len(parts)-1], 10, 64)
		}
		if e != nil || actual != size || !validMediaPrefix(decryptPrefix(data, s.ID, sequence), format, sequence) {
			c.JSON(400, gin.H{"message": "Uploaded video does not match its reservation"})
			return
		}
	}
	tx, e := h.db.Begin(ctx)
	if e != nil {
		c.Status(503)
		return
	}
	defer tx.Rollback(ctx)
	// A stable row lock serializes the first-live notification and stop/ack ordering.
	var state string
	if tx.QueryRow(ctx, `SELECT status FROM live_sessions WHERE id=$1 FOR UPDATE`, s.ID).Scan(&state) != nil {
		c.Status(503)
		return
	}
	_, e = tx.Exec(ctx, `UPDATE live_segments SET ready=TRUE WHERE session_id=$1 AND sequence=$2`, s.ID, sequence)
	if e != nil {
		c.Status(503)
		return
	}
	if sequence >= 0 {
		_, e = tx.Exec(ctx, `UPDATE live_sessions SET last_segment_at=NOW(),started_at=COALESCE(started_at,NOW()),status=CASE WHEN status='starting' THEN 'live' ELSE status END WHERE id=$1`, s.ID)
		if e != nil {
			c.Status(503)
			return
		}
		if state != "ended" {
			_, e = tx.Exec(ctx, `UPDATE live_stream_config SET is_live=TRUE,title=(SELECT title FROM live_sessions WHERE id=$1),provider='r2_direct',playback_hls_url=$2,updated_at=NOW() WHERE id='main'`, s.ID, directPrefix+s.ID+"/index.m3u8")
		}
	}
	if e != nil || tx.Commit(ctx) != nil {
		c.Status(503)
		return
	}
	if state == "ended" {
		_ = h.finalizeDirect(ctx, s.ID)
	}
	if state == "starting" && sequence >= 0 && h.notifier != nil {
		var title string
		_ = h.db.QueryRow(ctx, `SELECT title FROM live_sessions WHERE id=$1`, s.ID).Scan(&title)
		go func() {
			_, _ = h.notifier.Notify(context.Background(), notifications.BroadcastRequest{Title: "We're live now", Body: title + " — tap to join the service.", Category: "live", Data: map[string]interface{}{"open": "live"}})
		}()
	}
	c.JSON(200, gin.H{"ready": true, "status": state})
}
func directKey(id string) []byte {
	mac := hmac.New(sha256.New, []byte(os.Getenv("LIBRARY_ENCRYPTION_KEY")))
	mac.Write([]byte("shekinah-direct-hls:" + id))
	return mac.Sum(nil)[:16]
}
func directIV(sequence int) []byte {
	iv := make([]byte, 16)
	binary.BigEndian.PutUint64(iv[8:], uint64(sequence+1))
	return iv
}
func (h *Handler) DirectKey(c *gin.Context) {
	var s Session
	if h.db.QueryRow(c.Request.Context(), `SELECT id,price FROM live_sessions WHERE id=$1 AND transport='r2'`, c.Param("id")).Scan(&s.ID, &s.Price) != nil {
		c.Status(404)
		return
	}
	user, _ := auth.UserIDFromContext(c)
	if !h.canWatch(c.Request.Context(), &s, user) {
		c.Status(402)
		return
	}
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(200, "application/octet-stream", directKey(s.ID))
}
func decryptPrefix(b []byte, id string, seq int) []byte {
	n := len(b) / 16 * 16
	if n == 0 {
		return nil
	}
	out := make([]byte, n)
	block, _ := aes.NewCipher(directKey(id))
	cipher.NewCBCDecrypter(block, directIV(seq)).CryptBlocks(out, b[:n])
	return out
}
func validMediaPrefix(b []byte, format string, seq int) bool {
	if format == "mpegts" {
		return len(b) >= 376 && b[0] == 0x47 && b[188] == 0x47
	}
	if len(b) < 8 {
		return false
	}
	kind := string(b[4:8])
	if seq < 0 {
		// Chrome may emit moov without an ftyp box. Both forms contain valid
		// initialization metadata; media fragments must still start separately.
		return kind == "ftyp" || kind == "moov"
	}
	return kind == "moof" || kind == "styp"
}
func (h *Handler) DirectStatus(c *gin.Context) {
	s, _, ok := h.directOwner(c)
	if !ok {
		return
	}
	var next int
	var queued int
	if h.db.QueryRow(c.Request.Context(), `SELECT COALESCE(MAX(sequence) FILTER(WHERE sequence>=0)+1,0),COUNT(*) FILTER(WHERE NOT ready) FROM live_segments WHERE session_id=$1`, s.ID).Scan(&next, &queued) != nil {
		c.Status(503)
		return
	}
	c.JSON(200, gin.H{"sessionId": s.ID, "nextSequence": next, "pending": queued, "status": s.Status})
}
func (h *Handler) finalizeDirect(ctx context.Context, id string) error {
	// Partial recordings remain available up to their last contiguous saved segment.
	_, err := h.db.Exec(ctx, `INSERT INTO live_archives(session_id,status,object_key,size_bytes)
 SELECT l.id,'ready','r2-hls/'||l.id,COALESCE(SUM(s.size_bytes),0) FROM live_sessions l JOIN live_segments s ON s.session_id=l.id AND s.ready WHERE l.id=$1 AND l.status='ended' AND EXISTS(SELECT 1 FROM live_segments WHERE session_id=l.id AND sequence=0 AND ready) GROUP BY l.id
 ON CONFLICT(session_id) DO UPDATE SET status='ready',object_key=EXCLUDED.object_key,size_bytes=EXCLUDED.size_bytes,error='',updated_at=NOW()`, id)
	return err
}
func (h *Handler) DirectPlaylist(c *gin.Context) {
	ctx := c.Request.Context()
	var s Session
	var format string
	if h.db.QueryRow(ctx, `SELECT id,price,status,segment_format FROM live_sessions WHERE id=$1 AND transport='r2'`, c.Param("id")).Scan(&s.ID, &s.Price, &s.Status, &format) != nil {
		c.Status(404)
		return
	}
	user, _ := auth.UserIDFromContext(c)
	if !h.canWatch(ctx, &s, user) {
		c.JSON(402, gin.H{"message": "Purchase access to watch this service"})
		return
	}
	// A replay master stays small. Its media playlist is regenerated when selected,
	// allowing short-lived R2 links to be refreshed after a long pause or seek.
	if c.Query("media") != "1" {
		c.Header("Cache-Control", "private, no-store")
		c.Data(200, "application/vnd.apple.mpegurl", []byte("#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-STREAM-INF:BANDWIDTH=3500000\n"+directPrefix+s.ID+"/index.m3u8?media=1\n"))
		return
	}
	store, err := newArchiveStore(ctx)
	if err != nil {
		c.Status(503)
		return
	}
	rows, err := h.db.Query(ctx, `SELECT sequence,object_key,duration FROM live_segments WHERE session_id=$1 AND ready ORDER BY sequence`, s.ID)
	if err != nil {
		c.Status(503)
		return
	}
	defer rows.Close()
	type segment struct {
		seq      int
		key      string
		duration float64
	}
	all := []segment{}
	init := ""
	expected := 0
	for rows.Next() {
		var item segment
		if rows.Scan(&item.seq, &item.key, &item.duration) != nil {
			c.Status(503)
			return
		}
		if item.seq == -1 {
			init = item.key
			continue
		}
		if item.seq != expected {
			break
		}
		all = append(all, item)
		expected++
	}
	if rows.Err() != nil {
		c.Status(503)
		return
	}
	if len(all) == 0 || (format == "fmp4" && init == "") {
		c.Header("Retry-After", "2")
		c.Status(503)
		return
	}
	if s.Status != "ended" && len(all) > 6 {
		all = all[len(all)-6:]
	}
	presign := s3.NewPresignClient(store.client)
	sign := func(key string) (string, error) {
		r, e := presign.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key)}, func(o *s3.PresignOptions) { o.Expires = 6 * time.Hour })
		if e != nil {
			return "", e
		}
		return r.URL, nil
	}
	maxDuration := 1.0
	for _, item := range all {
		maxDuration = math.Max(maxDuration, item.duration)
	}
	var b strings.Builder
	fmt.Fprintf(&b, "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:%d\n#EXT-X-MEDIA-SEQUENCE:%d\n", int(math.Ceil(maxDuration)), all[0].seq)
	if s.Status == "ended" {
		b.WriteString("#EXT-X-PLAYLIST-TYPE:VOD\n")
	}
	if init != "" {
		fmt.Fprintf(&b, "#EXT-X-KEY:METHOD=AES-128,URI=\"key\",IV=0x%032x\n", directIV(-1))
		url, e := sign(init)
		if e != nil {
			c.Status(503)
			return
		}
		fmt.Fprintf(&b, "#EXT-X-MAP:URI=\"%s\"\n", url)
	}
	for _, item := range all {
		url, e := sign(item.key)
		if e != nil {
			c.Status(503)
			return
		}
		fmt.Fprintf(&b, "#EXT-X-KEY:METHOD=AES-128,URI=\"key\",IV=0x%032x\n#EXTINF:%.6f,\n%s\n", directIV(item.seq), item.duration, url)
	}
	if s.Status == "ended" {
		b.WriteString("#EXT-X-ENDLIST\n")
	}
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(200, "application/vnd.apple.mpegurl", []byte(b.String()))
}
