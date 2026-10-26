package sermonmedia

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

var ErrStreamNotConfigured = errors.New("cloudflare stream is not configured")

// StreamClient talks to the Cloudflare Stream video API for sermon uploads
// and live-service recordings.
type StreamClient struct {
	accountID  string
	apiToken   string
	baseURL    string
	httpClient *http.Client
}

func NewStreamClient(accountID string, apiToken string) StreamClient {
	return StreamClient{
		accountID:  strings.TrimSpace(accountID),
		apiToken:   strings.TrimSpace(apiToken),
		baseURL:    "https://api.cloudflare.com/client/v4",
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c StreamClient) Configured() bool {
	return c.accountID != "" && c.apiToken != ""
}

// StreamVideo is the subset of a Cloudflare Stream video the app needs.
type StreamVideo struct {
	UID           string
	Name          string
	ReadyToStream bool
	State         string
	ErrorReason   string
	ThumbnailURL  string
	HLSURL        string
	DurationSec   float64
	CreatedAt     time.Time
	LiveInputUID  string
}

type streamVideoPayload struct {
	UID           string            `json:"uid"`
	ReadyToStream bool              `json:"readyToStream"`
	Thumbnail     string            `json:"thumbnail"`
	Duration      float64           `json:"duration"`
	Created       string            `json:"created"`
	LiveInput     string            `json:"liveInput"`
	Meta          map[string]any    `json:"meta"`
	Playback      map[string]string `json:"playback"`
	Status        struct {
		State           string `json:"state"`
		ErrorReasonText string `json:"errorReasonText"`
	} `json:"status"`
}

type apiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (p streamVideoPayload) toVideo() StreamVideo {
	name := ""
	if raw, ok := p.Meta["name"].(string); ok {
		name = strings.TrimSpace(raw)
	}

	created, _ := time.Parse(time.RFC3339Nano, p.Created)

	return StreamVideo{
		UID:           strings.TrimSpace(p.UID),
		Name:          name,
		ReadyToStream: p.ReadyToStream,
		State:         strings.TrimSpace(p.Status.State),
		ErrorReason:   strings.TrimSpace(p.Status.ErrorReasonText),
		ThumbnailURL:  strings.TrimSpace(p.Thumbnail),
		HLSURL:        strings.TrimSpace(p.Playback["hls"]),
		DurationSec:   p.Duration,
		CreatedAt:     created,
		LiveInputUID:  strings.TrimSpace(p.LiveInput),
	}
}

// CreateTusUpload reserves a resumable (tus) upload the admin dashboard
// sends the file to directly, so large sermon videos never pass through
// this server. It returns the upload URL and the new video id.
func (c StreamClient) CreateTusUpload(ctx context.Context, sizeBytes int64, name string, maxDurationSeconds int) (string, string, error) {
	if !c.Configured() {
		return "", "", ErrStreamNotConfigured
	}
	if sizeBytes <= 0 {
		return "", "", errors.New("upload size must be greater than zero")
	}

	metadata := []string{
		"name " + base64.StdEncoding.EncodeToString([]byte(strings.TrimSpace(name))),
	}
	if maxDurationSeconds > 0 {
		metadata = append(metadata, "maxdurationseconds "+base64.StdEncoding.EncodeToString([]byte(strconv.Itoa(maxDurationSeconds))))
	}

	url := fmt.Sprintf("%s/accounts/%s/stream?direct_user=true", c.baseURL, c.accountID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", "", fmt.Errorf("prepare tus request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Tus-Resumable", "1.0.0")
	req.Header.Set("Upload-Length", strconv.FormatInt(sizeBytes, 10))
	req.Header.Set("Upload-Metadata", strings.Join(metadata, ","))

	res, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("create tus upload: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 64_000))
		return "", "", fmt.Errorf("cloudflare stream rejected the upload (%d): %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	uploadURL := strings.TrimSpace(res.Header.Get("Location"))
	uid := strings.TrimSpace(res.Header.Get("stream-media-id"))
	if uploadURL == "" || uid == "" {
		return "", "", errors.New("cloudflare stream returned no upload url or video id")
	}

	return uploadURL, uid, nil
}

func (c StreamClient) GetVideo(ctx context.Context, uid string) (StreamVideo, error) {
	var payload struct {
		Success bool               `json:"success"`
		Errors  []apiError         `json:"errors"`
		Result  streamVideoPayload `json:"result"`
	}

	if err := c.getJSON(ctx, fmt.Sprintf("/accounts/%s/stream/%s", c.accountID, uid), &payload); err != nil {
		return StreamVideo{}, err
	}
	if !payload.Success {
		return StreamVideo{}, fmt.Errorf("cloudflare stream video lookup failed: %s", firstError(payload.Errors))
	}

	return payload.Result.toVideo(), nil
}

// ListLiveInputVideos returns the recordings Cloudflare kept for a live input.
func (c StreamClient) ListLiveInputVideos(ctx context.Context, liveInputUID string) ([]StreamVideo, error) {
	var payload struct {
		Success bool                 `json:"success"`
		Errors  []apiError           `json:"errors"`
		Result  []streamVideoPayload `json:"result"`
	}

	if err := c.getJSON(ctx, fmt.Sprintf("/accounts/%s/stream/live_inputs/%s/videos", c.accountID, liveInputUID), &payload); err != nil {
		return nil, err
	}
	if !payload.Success {
		return nil, fmt.Errorf("cloudflare stream recordings lookup failed: %s", firstError(payload.Errors))
	}

	videos := make([]StreamVideo, 0, len(payload.Result))
	for _, item := range payload.Result {
		videos = append(videos, item.toVideo())
	}
	return videos, nil
}

func (c StreamClient) getJSON(ctx context.Context, path string, out any) error {
	if !c.Configured() {
		return ErrStreamNotConfigured
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("prepare cloudflare request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("cloudflare request: %w", err)
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 5_000_000))
	if err != nil {
		return fmt.Errorf("read cloudflare response: %w", err)
	}
	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("decode cloudflare response (%d): %w", res.StatusCode, err)
	}
	return nil
}

func firstError(errs []apiError) string {
	if len(errs) == 0 {
		return "unknown error"
	}
	return errs[0].Message
}

// FormatDuration turns seconds into "1:02:03" or "42:05".
func FormatDuration(seconds float64) string {
	if seconds <= 0 {
		return ""
	}
	total := int(seconds + 0.5)
	h, m, s := total/3600, (total%3600)/60, total%60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}
