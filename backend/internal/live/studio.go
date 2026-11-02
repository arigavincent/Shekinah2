package live

// The studio: cameras, OBS and video switchers stream to the video server
// with one fixed key. Pressing "Start streaming" starts the service (title
// and who may watch come from these settings), and the server can forward
// the same picture to YouTube.
import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const studioKey = "live_studio"

type Studio struct {
	CameraKey      string `json:"cameraKey"`
	Title          string `json:"title"`
	MembersOnly    bool   `json:"membersOnly"`
	Price          int    `json:"price"`
	ForwardEnabled bool   `json:"forwardEnabled"`
	ForwardURL     string `json:"forwardUrl"`
}

func (h *Handler) studio(ctx context.Context) Studio {
	var raw string
	st := Studio{Title: "Live Service"}
	if h.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key=$1`, studioKey).Scan(&raw) == nil {
		_ = json.Unmarshal([]byte(raw), &st)
	}
	if strings.TrimSpace(st.Title) == "" {
		st.Title = "Live Service"
	}
	return st
}

func (h *Handler) saveStudio(ctx context.Context, st Studio) error {
	raw, _ := json.Marshal(st)
	_, err := h.db.Exec(ctx, `INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW())
		ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, studioKey, string(raw))
	return err
}

// internalRequest: the server's own forwarder, reading with the shared secret.
func internalRequest(query string) bool {
	secret := env("LIVE_INTERNAL_SECRET", "")
	if len(secret) < 16 {
		return false
	}
	values, _ := url.ParseQuery(query)
	got := values.Get("internal")
	return got != "" && subtle.ConstantTimeCompare([]byte(got), []byte(secret)) == 1
}

// cameraPublish allows a publish with the studio key, starting the service if
// nothing is live (and refusing while someone else is broadcasting).
func (h *Handler) cameraPublish(ctx context.Context, key string) bool {
	st := h.studio(ctx)
	if key == "" || len(st.CameraKey) < 16 || subtle.ConstantTimeCompare([]byte(key), []byte(st.CameraKey)) != 1 {
		return false
	}
	conn, err := h.db.Acquire(ctx)
	if err != nil {
		return false
	}
	defer conn.Release()
	if _, err = conn.Exec(ctx, `SELECT pg_advisory_lock(73915001)`); err != nil {
		return false
	}
	defer func() { _, _ = conn.Exec(context.Background(), `SELECT pg_advisory_unlock(73915001)`) }()
	existing, currentKey, _, err := h.current(ctx)
	if err != nil {
		return false
	}
	if existing != nil {
		// The camera reconnecting to its own service is fine; anyone else is live.
		return strings.HasPrefix(currentKey, "cam-")
	}
	// No recording set-up here: changing the video server's settings would drop
	// the camera that is connecting. The camera records into the standing
	// "unassigned" folder, which the archiver claims when the service ends.
	id := "live-" + randomKey()[:12]
	_, _ = h.db.Exec(ctx, `UPDATE app_settings SET value = (value::jsonb || '{"chatOff": false}'::jsonb)::text WHERE key = 'live_chat'`)
	_, err = h.db.Exec(ctx, `INSERT INTO live_sessions (id, title, stream_key, price, recording_expected, transport, segment_format, members_only)
		VALUES ($1,$2,$3,$4,TRUE,'mediamtx','mpegts',$5)`, id, st.Title, "cam-"+id, st.Price, st.MembersOnly)
	return err == nil
}

type studioView struct {
	Studio
	Server      string `json:"server"`
	StreamKey   string `json:"streamKey"`
	FullURL     string `json:"fullUrl"`
	HLSURL      string `json:"hlsUrl"`
	WHEPURL     string `json:"whepUrl"`
	CamerasWork bool   `json:"camerasWork"`
}

func (h *Handler) studioView(ctx context.Context) studioView {
	st := h.studio(ctx)
	v := studioView{Studio: st, Server: h.rtmpBase, HLSURL: h.playbackURL(), WHEPURL: h.whipBase + "/" + path + "/whep",
		CamerasWork: env("LIVE_TRANSPORT", "mediamtx") == "mediamtx"}
	if st.CameraKey != "" {
		v.StreamKey = path + "?key=" + st.CameraKey
		v.FullURL = h.rtmpBase + "/" + path + "?key=" + st.CameraKey
	}
	return v
}

// GET /admin/live/studio
func (h *Handler) AdminStudio(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"studio": h.studioView(c.Request.Context())})
}

// PUT /admin/live/studio {"title","membersOnly","price","forwardEnabled","forwardUrl"}
func (h *Handler) AdminSaveStudio(c *gin.Context) {
	var req struct {
		Title          *string `json:"title"`
		MembersOnly    *bool   `json:"membersOnly"`
		Price          *int    `json:"price"`
		ForwardEnabled *bool   `json:"forwardEnabled"`
		ForwardURL     *string `json:"forwardUrl"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Check the live settings"})
		return
	}
	ctx := c.Request.Context()
	st := h.studio(ctx)
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" || len([]rune(t)) > 120 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Give the service a title (up to 120 characters)"})
			return
		}
		st.Title = t
	}
	if req.MembersOnly != nil {
		st.MembersOnly = *req.MembersOnly
	}
	if req.Price != nil {
		if *req.Price < 0 || *req.Price > 1_000_000 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Check the price"})
			return
		}
		st.Price = *req.Price
	}
	if req.ForwardURL != nil {
		u := strings.TrimSpace(*req.ForwardURL)
		if u != "" {
			parsed, err := url.Parse(u)
			if err != nil || (parsed.Scheme != "rtmp" && parsed.Scheme != "rtmps") || parsed.Host == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "The YouTube address must start with rtmp:// or rtmps://"})
				return
			}
		}
		st.ForwardURL = u
	}
	if req.ForwardEnabled != nil {
		st.ForwardEnabled = *req.ForwardEnabled
	}
	if st.ForwardEnabled && st.ForwardURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Add the YouTube stream address and key before turning forwarding on"})
		return
	}
	if err := h.saveStudio(ctx, st); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not save"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"studio": h.studioView(ctx), "message": "Live settings saved"})
}

// POST /admin/live/studio/key — a new camera key (the old one stops working).
func (h *Handler) AdminNewStudioKey(c *gin.Context) {
	ctx := c.Request.Context()
	st := h.studio(ctx)
	st.CameraKey = randomKey()
	if err := h.saveStudio(ctx, st); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not create a key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"studio": h.studioView(ctx), "message": "New stream key ready. Update it in OBS or the camera."})
}

// GET /live/forward-target — asked by the video server when a stream starts.
func (h *Handler) ForwardTarget(c *gin.Context) {
	secret := env("LIVE_INTERNAL_SECRET", "")
	if len(secret) < 16 || subtle.ConstantTimeCompare([]byte(c.GetHeader("X-Internal-Secret")), []byte(secret)) != 1 {
		c.Status(http.StatusNotFound)
		return
	}
	st := h.studio(c.Request.Context())
	if !st.ForwardEnabled || st.ForwardURL == "" {
		c.Status(http.StatusNoContent)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.String(http.StatusOK, st.ForwardURL)
}

// claimCameraRecording moves the studio camera's recording (made in the
// standing "unassigned" folder) into the service's own folder for archiving.
func (h *Handler) claimCameraRecording(ctx context.Context, id string) {
	var key string
	var created time.Time
	if h.db.QueryRow(ctx, `SELECT stream_key, created_at FROM live_sessions WHERE id=$1`, id).Scan(&key, &created) != nil || !strings.HasPrefix(key, "cam-") {
		return
	}
	files, _ := filepath.Glob(filepath.Join(archiveDir(), "unassigned", path, "*.mp4"))
	if len(files) == 0 {
		return
	}
	dest := filepath.Join(archiveDir(), id, path)
	if os.MkdirAll(dest, 0o755) != nil {
		return
	}
	for _, f := range files {
		if info, err := os.Stat(f); err == nil && info.ModTime().After(created.Add(-time.Minute)) {
			_ = os.Rename(f, filepath.Join(dest, filepath.Base(f)))
		}
	}
}

// resetRecordingPath points recording back at the standing folder once a
// service ends, so a camera that starts next records somewhere neutral.
func (h *Handler) resetRecordingPath(ctx context.Context) {
	body := []byte(`{"record":true,"recordPath":"/recordings/unassigned/%path/%Y-%m-%d_%H-%M-%S-%f","recordDeleteAfter":"0s"}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, h.apiBase+"/v3/config/paths/patch/"+path, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if res, err := h.client.Do(req); err == nil {
		res.Body.Close()
	}
}
