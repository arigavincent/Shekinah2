package live

// Admin management of published service recordings: list, rename, describe,
// change or reset the cover, and delete (video files included).
import (
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/gin-gonic/gin"
)

// GET /admin/replays
func (h *Handler) AdminReplays(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `SELECT l.id, l.title, a.description, l.price, l.started_at, a.status, a.thumbnail_url, a.thumbnail_custom,
			ROUND(COALESCE((SELECT SUM(s.duration) FROM live_segments s WHERE s.session_id=l.id AND s.ready AND s.sequence>=0),0))::int
		FROM live_sessions l JOIN live_archives a ON a.session_id=l.id WHERE l.status='ended' ORDER BY l.started_at DESC NULLS LAST LIMIT 300`)
	if err != nil {
		c.JSON(500, gin.H{"message": "Could not load recordings"})
		return
	}
	defer rows.Close()
	items := []gin.H{}
	for rows.Next() {
		var id, title, desc, status, thumb string
		var price, secs int
		var custom bool
		var started *time.Time
		if rows.Scan(&id, &title, &desc, &price, &started, &status, &thumb, &custom, &secs) != nil {
			continue
		}
		items = append(items, gin.H{"id": id, "title": title, "description": desc, "price": price, "date": started, "status": status,
			"thumbnailUrl": thumb, "customCover": custom, "seconds": secs})
	}
	c.JSON(200, gin.H{"items": items})
}

// PATCH /admin/replays/:id {"title","description","thumbnailUrl","resetCover"}
// A title change redraws the automatic cover. thumbnailUrl sets the admin's own
// image; resetCover goes back to the automatic branded cover.
func (h *Handler) AdminUpdateReplay(c *gin.Context) {
	var req struct {
		Title        *string `json:"title"`
		Description  *string `json:"description"`
		ThumbnailURL *string `json:"thumbnailUrl"`
		ResetCover   bool    `json:"resetCover"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"message": "Invalid changes"})
		return
	}
	ctx := c.Request.Context()
	id := c.Param("id")
	var exists bool
	_ = h.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM live_archives WHERE session_id=$1)`, id).Scan(&exists)
	if !exists {
		c.JSON(404, gin.H{"message": "Recording not found"})
		return
	}
	redraw := false
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" || len(t) > 160 {
			c.JSON(400, gin.H{"message": "Give the recording a title (up to 160 characters)"})
			return
		}
		if _, err := h.db.Exec(ctx, `UPDATE live_sessions SET title=$2 WHERE id=$1`, id, t); err != nil {
			c.JSON(500, gin.H{"message": "Could not save"})
			return
		}
		redraw = true
	}
	if req.Description != nil {
		d := strings.TrimSpace(*req.Description)
		if len(d) > 4000 {
			d = d[:4000]
		}
		_, _ = h.db.Exec(ctx, `UPDATE live_archives SET description=$2 WHERE session_id=$1`, id, d)
	}
	if req.ThumbnailURL != nil && strings.TrimSpace(*req.ThumbnailURL) != "" {
		u, err := url.Parse(strings.TrimSpace(*req.ThumbnailURL))
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
			c.JSON(400, gin.H{"message": "Upload an image for the cover"})
			return
		}
		h.dropAutoCover(c, id)
		_, _ = h.db.Exec(ctx, `UPDATE live_archives SET thumbnail_url=$2, thumbnail_custom=TRUE WHERE session_id=$1`, id, u.String())
		redraw = false
	} else if req.ResetCover {
		_, _ = h.db.Exec(ctx, `UPDATE live_archives SET thumbnail_custom=FALSE, thumbnail_attempts=0 WHERE session_id=$1`, id)
		redraw = true
	}
	if redraw {
		if err := h.drawCover(ctx, id); err != nil {
			// The background worker will retry.
			_, _ = h.db.Exec(ctx, `UPDATE live_archives SET thumbnail_url='' WHERE session_id=$1 AND NOT thumbnail_custom`, id)
		}
	}
	var thumb string
	var custom bool
	_ = h.db.QueryRow(ctx, `SELECT thumbnail_url, thumbnail_custom FROM live_archives WHERE session_id=$1`, id).Scan(&thumb, &custom)
	c.JSON(200, gin.H{"message": "Recording updated", "thumbnailUrl": thumb, "customCover": custom})
}

func (h *Handler) dropAutoCover(c *gin.Context, id string) {
	var old string
	var custom bool
	if h.db.QueryRow(c.Request.Context(), `SELECT thumbnail_url, thumbnail_custom FROM live_archives WHERE session_id=$1`, id).Scan(&old, &custom) != nil || custom {
		return
	}
	base := strings.TrimRight(env("R2_SERMONS_PUBLIC_BASE_URL", env("R2_PUBLIC_BASE_URL", "")), "/")
	if store, err := newArchiveStore(c.Request.Context()); err == nil && base != "" {
		h.removeOwnCover(c.Request.Context(), store, base, old)
	}
}

// DELETE /admin/replays/:id — removes the recording from the app and deletes
// its video files. The service record (title, payments, chat) is kept.
func (h *Handler) AdminDeleteReplay(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	var status, archiveKey string
	if h.db.QueryRow(ctx, `SELECT l.status, a.object_key FROM live_sessions l JOIN live_archives a ON a.session_id=l.id WHERE l.id=$1`, id).Scan(&status, &archiveKey) != nil {
		c.JSON(404, gin.H{"message": "Recording not found"})
		return
	}
	if status != "ended" {
		c.JSON(409, gin.H{"message": "End the broadcast before deleting its recording"})
		return
	}
	store, err := newArchiveStore(ctx)
	if err != nil {
		c.JSON(503, gin.H{"message": "Recording storage is unavailable; try again"})
		return
	}
	keys := []string{}
	if archiveKey != "" && !strings.HasPrefix(archiveKey, "r2-hls/") {
		keys = append(keys, archiveKey)
	}
	rows, err := h.db.Query(ctx, `SELECT object_key FROM live_segments WHERE session_id=$1`, id)
	if err == nil {
		for rows.Next() {
			var k string
			if rows.Scan(&k) == nil {
				keys = append(keys, k)
			}
		}
		rows.Close()
	}
	for start := 0; start < len(keys); start += 1000 {
		batch := keys[start:min(start+1000, len(keys))]
		objs := make([]types.ObjectIdentifier, 0, len(batch))
		for _, k := range batch {
			objs = append(objs, types.ObjectIdentifier{Key: aws.String(k)})
		}
		if _, err := store.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{Bucket: aws.String(store.bucket), Delete: &types.Delete{Objects: objs, Quiet: aws.Bool(true)}}); err != nil {
			// Fall back to one by one (some S3-compatible stores lack batch delete).
			for _, k := range batch {
				_, _ = store.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(k)})
			}
		}
	}
	h.dropAutoCover(c, id)
	tx, err := h.db.Begin(ctx)
	if err != nil {
		c.JSON(503, gin.H{"message": "Could not delete"})
		return
	}
	defer tx.Rollback(ctx)
	_, err1 := tx.Exec(ctx, `DELETE FROM live_segments WHERE session_id=$1`, id)
	_, err2 := tx.Exec(ctx, `DELETE FROM live_archives WHERE session_id=$1`, id)
	// Stops the media-server archiver from recreating it.
	_, _ = tx.Exec(ctx, `UPDATE live_sessions SET recording_expected=FALSE WHERE id=$1`, id)
	_, _ = tx.Exec(ctx, `UPDATE live_stream_config SET playback_hls_url='' WHERE playback_hls_url LIKE '%' || $1 || '%' AND NOT is_live`, id)
	if err1 != nil || err2 != nil || tx.Commit(ctx) != nil {
		c.JSON(500, gin.H{"message": "Could not delete"})
		return
	}
	_ = os.Remove(filepath.Join(archiveCache(), id+".mp4"))
	c.JSON(200, gin.H{"message": "Recording deleted"})
}
