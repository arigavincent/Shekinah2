// Package live runs broadcasts made from the app: a permitted member starts
// a session, their phone streams to MediaMTX with the session's key, and a
// watchdog marks the service live the moment pictures arrive (telling every
// member) and ends it if the stream stops.
package live

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
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
	whipBase string
	apiBase  string

	mu      sync.Mutex
	viewers map[string]time.Time

	// Paid lives: who may watch (checked by the video server per request).
	tokens  TokenParser
	staff   func(ctx context.Context, userID string) bool
	allowMu sync.Mutex
	allowed map[string]time.Time // token|session -> until
}

type TokenParser interface{ ParseToken(string) (string, error) }

// UseAccess tells the handler how to read sign-in tokens and who counts as
// staff (hosts, moderators, admins watch paid lives free).
func (h *Handler) UseAccess(tokens TokenParser, staff func(ctx context.Context, userID string) bool) {
	h.tokens, h.staff = tokens, staff
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
		whipBase: env("LIVE_WHIP_URL", "http://127.0.0.1:8889"),
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
	// A paid live: viewers need access (paid, or staff) to watch.
	Price  int  `json:"price"`
	Access bool `json:"access"`
}

func (h *Handler) playbackURL() string { return h.hlsBase + "/" + path + "/index.m3u8" }

func (h *Handler) current(ctx context.Context) (*Session, string, string, error) {
	var s Session
	var key, broadcasterID string
	err := h.db.QueryRow(ctx, `
		SELECT l.id, l.title, l.status, COALESCE(u.name, ''), l.started_at, l.created_at, l.stream_key, COALESCE(l.broadcaster_id::text, ''), l.price
		FROM live_sessions l LEFT JOIN users u ON u.id = l.broadcaster_id
		WHERE l.status IN ('starting', 'live') ORDER BY l.created_at DESC LIMIT 1
	`).Scan(&s.ID, &s.Title, &s.Status, &s.Broadcaster, &s.StartedAt, &s.CreatedAt, &key, &broadcasterID, &s.Price)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", "", nil
	}
	if err != nil {
		return nil, "", "", err
	}
	s.PlaybackURL = h.playbackURL()
	var transport string
	_ = h.db.QueryRow(ctx, `SELECT transport FROM live_sessions WHERE id=$1`, s.ID).Scan(&transport)
	if transport == "r2" {
		s.PlaybackURL = directPrefix + s.ID + "/index.m3u8"
	}
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
		Title     string `json:"title"`
		Price     int    `json:"price"`
		Transport string `json:"transport"`
		Format    string `json:"format"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"message": "Check the broadcast title and price"})
		return
	}
	if req.Transport == "" {
		req.Transport = env("LIVE_TRANSPORT", "mediamtx")
	}
	if req.Format == "" {
		req.Format = "mpegts"
	}
	if (req.Transport != "mediamtx" && req.Transport != "r2") || (req.Format != "mpegts" && req.Format != "fmp4") {
		c.JSON(400, gin.H{"message": "Unsupported broadcast format"})
		return
	}
	if req.Price < 0 || req.Price > 1_000_000 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Check the price"})
		return
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Live Service"
	}
	if chars := []rune(title); len(chars) > 120 {
		title = string(chars[:120])
	}
	ctx := c.Request.Context()
	conn, lockErr := h.db.Acquire(ctx)
	if lockErr != nil {
		c.JSON(503, gin.H{"message": "Broadcast service unavailable"})
		return
	}
	defer conn.Release()
	if _, lockErr = conn.Exec(ctx, `SELECT pg_advisory_lock(73915001)`); lockErr != nil {
		c.JSON(503, gin.H{"message": "Could not reserve broadcast"})
		return
	}
	defer func() { _, _ = conn.Exec(context.Background(), `SELECT pg_advisory_unlock(73915001)`) }()
	existing, _, broadcasterID, err := h.current(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not start the live"})
		return
	}
	if existing != nil && broadcasterID != userID {
		c.JSON(http.StatusConflict, gin.H{"message": existing.Broadcaster + " is already live. Only one broadcast at a time."})
		return
	}
	// Finish the old recording before replacing the broadcaster's session.
	if existing != nil {
		h.end(ctx)
	}

	key := randomKey()
	id := "live-" + randomKey()[:12]
	var recordingErr error
	if req.Transport == "r2" {
		_, recordingErr = newArchiveStore(ctx)
	} else {
		recordingErr = h.prepareRecording(ctx, id)
	}
	if err := recordingErr; err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": fmt.Sprintf("Recording server is unavailable: %v", err)})
		return
	}
	// Each new live starts with chat on.
	_, _ = h.db.Exec(ctx, `UPDATE app_settings SET value = (value::jsonb || '{"chatOff": false}'::jsonb)::text WHERE key = 'live_chat'`)
	if _, err := h.db.Exec(ctx, `INSERT INTO live_sessions (id, title, broadcaster_id, stream_key, price, recording_expected,transport,segment_format) VALUES ($1, $2, $3, $4, $5, TRUE,$6,$7)`, id, title, userID, key, req.Price, req.Transport, req.Format); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not start the live"})
		return
	}
	c.Set("audit_item_id", id)
	session, _, _, _ := h.current(ctx)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusCreated, gin.H{
		"transport":     req.Transport,
		"segmentFormat": req.Format,
		"encryptionKey": base64.StdEncoding.EncodeToString(directKey(id)),
		"directBase":    directPrefix + id,
		"session":       session,
		"publishUrl":    h.rtmpBase + "/" + path + "?key=" + key,
		"whipUrl":       h.whipBase + "/" + path + "/whip?key=" + key,
	})
}

// POST /live/stop: the broadcaster (or an admin with the permission) ends it.
func (h *Handler) Stop(c *gin.Context) {
	var req struct {
		SessionID string `json:"sessionId"`
	}
	if c.Request.ContentLength > 0 && c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"message": "Check the broadcast session"})
		return
	}
	ctx := c.Request.Context()
	conn, e := h.db.Acquire(ctx)
	if e != nil {
		c.JSON(503, gin.H{"message": "Broadcast service unavailable"})
		return
	}
	defer conn.Release()
	if _, e = conn.Exec(ctx, `SELECT pg_advisory_lock(73915001)`); e != nil {
		c.JSON(503, gin.H{"message": "Broadcast service unavailable"})
		return
	}
	defer func() { _, _ = conn.Exec(context.Background(), `SELECT pg_advisory_unlock(73915001)`) }()
	user, _ := auth.UserIDFromContext(c)
	session, _, owner, err := h.current(c.Request.Context())
	if err != nil {
		c.JSON(503, gin.H{"message": "Could not load broadcast"})
		return
	}
	if req.SessionID != "" && (session == nil || session.ID != req.SessionID) {
		c.JSON(409, gin.H{"message": "This broadcast has already ended or changed"})
		return
	}
	if owner != "" && owner != user {
		var admin bool
		_ = h.db.QueryRow(c.Request.Context(), `SELECT role IN ('admin','super_admin') FROM users WHERE id=$1`, user).Scan(&admin)
		if !admin {
			c.JSON(403, gin.H{"message": "Only this broadcaster or an admin may end the service"})
			return
		}
	}
	if session != nil {
		c.Set("audit_item_id", session.ID)
	}
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
	_, _ = h.db.Exec(ctx, `INSERT INTO live_archives(session_id,status,object_key,size_bytes) SELECT l.id,'ready','r2-hls/'||l.id,COALESCE(SUM(s.size_bytes),0) FROM live_sessions l JOIN live_segments s ON s.session_id=l.id AND s.ready WHERE l.transport='r2' AND l.status='ended' AND EXISTS(SELECT 1 FROM live_segments WHERE session_id=l.id AND sequence=0 AND ready) GROUP BY l.id ON CONFLICT(session_id) DO NOTHING`)
	if env("LIVE_TRANSPORT", "mediamtx") == "r2" {
		return
	}
	// Drop both native RTMP and browser WebRTC publishers so recordings can finalize.
	for _, endpoint := range []string{"/v3/rtmp/conns", "/v3/webrtc/sessions"} {
		if req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.apiBase+endpoint+"/list", nil); err == nil {
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
						kick, _ := http.NewRequestWithContext(ctx, http.MethodPost, h.apiBase+endpoint+"/kick/"+item.ID, nil)
						if r, err := h.client.Do(kick); err == nil {
							r.Body.Close()
						}
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
	if session != nil {
		userID, _ := auth.UserIDFromContext(c)
		session.Access = h.canWatch(c.Request.Context(), session, userID)
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

// canWatch: free lives are open to all; a paid one to those who paid
// (confirmed by finance) and to staff.
func (h *Handler) canWatch(ctx context.Context, s *Session, userID string) bool {
	if s.Price <= 0 {
		return true
	}
	if userID == "" {
		return false
	}
	if h.staff != nil && h.staff(ctx, userID) {
		return true
	}
	var paid bool
	_ = h.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM giving_transactions WHERE item_id = $1 AND user_id::text = $2 AND status = 'success')`, s.ID, userID).Scan(&paid)
	return paid
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
		Token  string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Status(http.StatusUnauthorized)
		return
	}
	if req.Action == "read" || req.Action == "playback" {
		// A paid live's picture only goes to those allowed to watch it. The
		// app sends the member's sign-in token with every request.
		if h.readAllowed(c.Request.Context(), req.Token, req.Query) {
			c.Status(http.StatusOK)
		} else {
			c.Status(http.StatusUnauthorized)
		}
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

func (h *Handler) readAllowed(ctx context.Context, token, query string) bool {
	session, _, _, err := h.current(ctx)
	if err != nil || session == nil {
		return false
	}
	if session.Price <= 0 {
		return true
	}
	if token == "" {
		for _, part := range strings.Split(query, "&") {
			if strings.HasPrefix(part, "jwt=") {
				token = strings.TrimPrefix(part, "jwt=")
			}
		}
	}
	if token == "" || h.tokens == nil {
		return false
	}
	userID, parseErr := h.tokens.ParseToken(token)
	if parseErr != nil {
		return false
	}
	// Segments are requested every second or two; remember entitlements briefly.
	cacheKey := token + "|" + session.ID
	h.allowMu.Lock()
	if h.allowed == nil {
		h.allowed = map[string]time.Time{}
	}
	until, ok := h.allowed[cacheKey]
	h.allowMu.Unlock()
	if ok && time.Now().Before(until) {
		return true
	}
	if !h.canWatch(ctx, session, userID) {
		return false
	}
	h.allowMu.Lock()
	for k, t := range h.allowed {
		if time.Now().After(t) {
			delete(h.allowed, k)
		}
	}
	h.allowed[cacheKey] = time.Now().Add(60 * time.Second)
	h.allowMu.Unlock()
	return true
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
		var transport string
		var last *time.Time
		_ = h.db.QueryRow(ctx, `SELECT transport,last_segment_at FROM live_sessions WHERE id=$1`, session.ID).Scan(&transport, &last)
		if transport == "r2" {
			stale := time.Since(session.CreatedAt) > 3*time.Minute
			if last != nil {
				stale = time.Since(*last) > 3*time.Minute
			}
			if stale {
				h.end(ctx)
			} else {
				n := h.viewerCount()
				_, _ = h.db.Exec(ctx, `UPDATE live_sessions SET peak_viewers=GREATEST(peak_viewers,$2) WHERE id=$1`, session.ID, n)
				_, _ = h.db.Exec(ctx, `UPDATE live_stream_config SET viewers=$1 WHERE id='main'`, itoa(n))
			}
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
