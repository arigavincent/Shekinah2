// Package live runs broadcasts made from the app: a permitted member starts
// a session, their phone streams to MediaMTX with the session's key, and a
// watchdog marks the service live the moment pictures arrive (telling every
// member) and ends it if the stream stops.
package live

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/notifications"
)

const path = "church"

type Notifier interface {
	Notify(ctx context.Context, req notifications.BroadcastRequest) (gin.H, error)
}

type ChatCloser interface{ CloseLive() }

type Handler struct {
	db       *pgxpool.Pool
	notifier Notifier
	chat     ChatCloser
	client   *http.Client
	// Where phones publish and where viewers watch, as phones reach them.
	rtmpBase string
	hlsBase  string
	apiBase  string

	mu      sync.Mutex
	viewers map[string]time.Time
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return strings.TrimRight(v, "/")
	}
	return fallback
}

func NewHandler(db *pgxpool.Pool, notifier Notifier, chat ChatCloser) *Handler {
	return &Handler{
		db: db, notifier: notifier, chat: chat,
		client:   &http.Client{Timeout: 5 * time.Second},
		rtmpBase: env("LIVE_RTMP_URL", "rtmp://127.0.0.1:1935"),
		hlsBase:  env("LIVE_HLS_URL", "http://127.0.0.1:8888"),
		apiBase:  env("LIVE_MEDIAMTX_API", "http://127.0.0.1:9997"),
		viewers:  map[string]time.Time{},
	}
}

type Session struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Status      string     `json:"status"`
	Broadcaster string     `json:"broadcaster"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	PlaybackURL string     `json:"playbackUrl"`
	Viewers     int        `json:"viewers"`
}

func (h *Handler) playbackURL() string { return h.hlsBase + "/" + path + "/index.m3u8" }

func (h *Handler) current(ctx context.Context) (*Session, string, string, error) {
	var s Session
	var key, broadcasterID string
	err := h.db.QueryRow(ctx, `
		SELECT l.id, l.title, l.status, COALESCE(u.name, ''), l.started_at, l.created_at, l.stream_key, COALESCE(l.broadcaster_id::text, '')
		FROM live_sessions l LEFT JOIN users u ON u.id = l.broadcaster_id
		WHERE l.status IN ('starting', 'live') ORDER BY l.created_at DESC LIMIT 1
	`).Scan(&s.ID, &s.Title, &s.Status, &s.Broadcaster, &s.StartedAt, &s.CreatedAt, &key, &broadcasterID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", "", nil
	}
	if err != nil {
		return nil, "", "", err
	}
	s.PlaybackURL = h.playbackURL()
	s.Viewers = h.viewerCount()
	return &s, key, broadcasterID, nil
}

func randomKey() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// POST /live/start {"title": "..."}: returns where to stream.
func (h *Handler) Start(c *gin.Context) {
	userID, _ := auth.UserIDFromContext(c)
	var req struct {
		Title string `json:"title"`
	}
	_ = c.ShouldBindJSON(&req)
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Live Service"
	}
	if len(title) > 120 {
		title = title[:120]
	}
	ctx := c.Request.Context()
	existing, _, broadcasterID, err := h.current(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not start the live"})
		return
	}
	if existing != nil && broadcasterID != userID {
		c.JSON(http.StatusConflict, gin.H{"message": existing.Broadcaster + " is already live. Only one broadcast at a time."})
		return
	}
	// Starting again (e.g. after the app was closed) replaces your own session.
	_, _ = h.db.Exec(ctx, `UPDATE live_sessions SET status = 'ended', ended_at = NOW() WHERE status IN ('starting','live') AND broadcaster_id = $1`, userID)

	key := randomKey()
	id := "live-" + randomKey()[:12]
	if _, err := h.db.Exec(ctx, `INSERT INTO live_sessions (id, title, broadcaster_id, stream_key) VALUES ($1, $2, $3, $4)`, id, title, userID, key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not start the live"})
		return
	}
	session, _, _, _ := h.current(ctx)
	c.JSON(http.StatusCreated, gin.H{
		"session":    session,
		"publishUrl": h.rtmpBase + "/" + path + "?key=" + key,
	})
}

// POST /live/stop: the broadcaster (or an admin with the permission) ends it.
func (h *Handler) Stop(c *gin.Context) {
	h.end(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) end(ctx context.Context) {
	_, _ = h.db.Exec(ctx, `UPDATE live_sessions SET status = 'ended', ended_at = NOW() WHERE status IN ('starting','live')`)
	_, _ = h.db.Exec(ctx, `UPDATE live_stream_config SET is_live = FALSE, viewers = '0', updated_at = NOW() WHERE id = 'main'`)
	h.mu.Lock()
	h.viewers = map[string]time.Time{}
	h.mu.Unlock()
	if h.chat != nil {
		h.chat.CloseLive()
	}
	// Let the server drop the publisher too.
	if req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.apiBase+"/v3/rtmpconns/list", nil); err == nil {
		if resp, err := h.client.Do(req); err == nil {
			var list struct {
				Items []struct {
					ID    string `json:"id"`
					State string `json:"state"`
				} `json:"items"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&list)
			resp.Body.Close()
			for _, item := range list.Items {
				if item.State == "publish" {
					kick, _ := http.NewRequestWithContext(ctx, http.MethodPost, h.apiBase+"/v3/rtmpconns/kick/"+item.ID, nil)
					if r, err := h.client.Do(kick); err == nil {
						r.Body.Close()
					}
				}
			}
		}
	}
}

// GET /live/current: what viewers need (no key).
func (h *Handler) Current(c *gin.Context) {
	session, _, _, err := h.current(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load live"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

// POST /live/heartbeat {"viewerId": "..."}: each watching phone checks in every 15 s.
func (h *Handler) Heartbeat(c *gin.Context) {
	var req struct {
		ViewerID string `json:"viewerId"`
	}
	_ = c.ShouldBindJSON(&req)
	if id := strings.TrimSpace(req.ViewerID); id != "" && len(id) < 80 {
		h.mu.Lock()
		h.viewers[id] = time.Now()
		h.mu.Unlock()
	}
	c.JSON(http.StatusOK, gin.H{"viewers": h.viewerCount()})
}

func (h *Handler) viewerCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	n := 0
	for id, seen := range h.viewers {
		if time.Since(seen) > 40*time.Second {
			delete(h.viewers, id)
			continue
		}
		n++
	}
	return n
}

// POST /live/mediamtx-auth: MediaMTX asks before anyone publishes.
func (h *Handler) MediaMTXAuth(c *gin.Context) {
	var req struct {
		Action string `json:"action"`
		Path   string `json:"path"`
		Query  string `json:"query"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Status(http.StatusUnauthorized)
		return
	}
	if req.Action != "publish" {
		c.Status(http.StatusOK)
		return
	}
	key := ""
	for _, part := range strings.Split(req.Query, "&") {
		if strings.HasPrefix(part, "key=") {
			key = strings.TrimPrefix(part, "key=")
		}
	}
	_, current, _, err := h.current(c.Request.Context())
	if err != nil || req.Path != path || key == "" || current == "" || key != current {
		c.Status(http.StatusUnauthorized)
		return
	}
	c.Status(http.StatusOK)
}

// Watch checks MediaMTX every few seconds and moves sessions along.
func (h *Handler) Watch(ctx context.Context) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	var lostSince time.Time
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		session, _, _, err := h.current(ctx)
		if err != nil || session == nil {
			lostSince = time.Time{}
			continue
		}
		ready := h.pathReady(ctx)
		switch {
		case session.Status == "starting" && ready:
			lostSince = time.Time{}
			_, _ = h.db.Exec(ctx, `UPDATE live_sessions SET status = 'live', started_at = NOW() WHERE id = $1`, session.ID)
			_, _ = h.db.Exec(ctx, `
				UPDATE live_stream_config SET is_live = TRUE, title = $1, provider = 'mediamtx', playback_hls_url = $2, viewers = '0', updated_at = NOW()
				WHERE id = 'main'`, session.Title, h.playbackURL())
			if h.notifier != nil {
				go func(title string) {
					_, _ = h.notifier.Notify(context.Background(), notifications.BroadcastRequest{
						Title: "We're live now", Body: title + " — tap to join the service.", Category: "live",
						Data: map[string]interface{}{"open": "live"},
					})
				}(session.Title)
			}
		case session.Status == "starting" && time.Since(session.CreatedAt) > 3*time.Minute:
			h.end(ctx)
		case session.Status == "live" && !ready:
			if lostSince.IsZero() {
				lostSince = time.Now()
			} else if time.Since(lostSince) > 60*time.Second {
				lostSince = time.Time{}
				h.end(ctx)
			}
		case session.Status == "live":
			lostSince = time.Time{}
			n := h.viewerCount()
			_, _ = h.db.Exec(ctx, `UPDATE live_sessions SET peak_viewers = GREATEST(peak_viewers, $2) WHERE id = $1`, session.ID, n)
			_, _ = h.db.Exec(ctx, `UPDATE live_stream_config SET viewers = $1 WHERE id = 'main'`, itoa(n))
		}
	}
}

func (h *Handler) pathReady(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.apiBase+"/v3/paths/get/"+path, nil)
	if err != nil {
		return false
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	var out struct {
		Ready bool `json:"ready"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out.Ready
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
