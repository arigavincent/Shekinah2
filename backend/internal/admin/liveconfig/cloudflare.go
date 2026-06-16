package liveconfig

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
)

var ErrCloudflareNotConfigured = errors.New("cloudflare stream is not configured")

type CloudflareStreamClient struct {
	accountID                string
	apiToken                 string
	recordingMode            string
	deleteRecordingAfterDays int
	httpClient               *http.Client
}

func NewCloudflareStreamClient(cfg config.Config) CloudflareStreamClient {
	mode := strings.TrimSpace(cfg.CloudflareStreamRecordingMode)
	if mode == "" {
		mode = "automatic"
	}

	days := cfg.CloudflareStreamDeleteRecordingAfterDays
	if days < 30 {
		days = 45
	}

	return CloudflareStreamClient{
		accountID:                strings.TrimSpace(cfg.CloudflareAccountID),
		apiToken:                 strings.TrimSpace(cfg.CloudflareStreamAPIToken),
		recordingMode:            mode,
		deleteRecordingAfterDays: days,
		httpClient:               &http.Client{Timeout: 25 * time.Second},
	}
}

func (c CloudflareStreamClient) configured() bool {
	return c.accountID != "" && c.apiToken != ""
}

type cloudflareCreateLiveInputRequest struct {
	Meta                     map[string]string `json:"meta"`
	Recording                map[string]any    `json:"recording"`
	DeleteRecordingAfterDays int               `json:"deleteRecordingAfterDays"`
	Enabled                  bool              `json:"enabled"`
}

type cloudflareAPIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type cloudflareCreateLiveInputResponse struct {
	Success bool                 `json:"success"`
	Errors  []cloudflareAPIError `json:"errors"`
	Result  struct {
		UID   string `json:"uid"`
		RTMPS struct {
			URL       string `json:"url"`
			StreamKey string `json:"streamKey"`
		} `json:"rtmps"`
		SRT struct {
			URL        string `json:"url"`
			StreamID   string `json:"streamId"`
			Passphrase string `json:"passphrase"`
		} `json:"srt"`
	} `json:"result"`
}

type cloudflareDeleteLiveInputResponse struct {
	Success bool                 `json:"success"`
	Errors  []cloudflareAPIError `json:"errors"`
}

func (c CloudflareStreamClient) CreateLiveInput(ctx context.Context, name string) (CloudflareLiveInput, error) {
	if !c.configured() {
		return CloudflareLiveInput{}, ErrCloudflareNotConfigured
	}

	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		cleanName = "Shekinah Live Stream"
	}

	payload := cloudflareCreateLiveInputRequest{
		Meta: map[string]string{
			"name": cleanName,
		},
		Recording: map[string]any{
			"mode":                c.recordingMode,
			"requireSignedURLs":   false,
			"hideLiveViewerCount": false,
			"timeoutSeconds":      0,
		},
		DeleteRecordingAfterDays: c.deleteRecordingAfterDays,
		Enabled:                  true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return CloudflareLiveInput{}, fmt.Errorf("encode cloudflare live input payload: %w", err)
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/stream/live_inputs", c.accountID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return CloudflareLiveInput{}, fmt.Errorf("prepare cloudflare request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return CloudflareLiveInput{}, fmt.Errorf("create cloudflare live input: %w", err)
	}
	defer res.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(res.Body, 1_000_000))
	if err != nil {
		return CloudflareLiveInput{}, fmt.Errorf("read cloudflare response: %w", err)
	}

	var decoded cloudflareCreateLiveInputResponse
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return CloudflareLiveInput{}, fmt.Errorf("decode cloudflare response: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode > 299 || !decoded.Success {
		return CloudflareLiveInput{}, fmt.Errorf("%s", cloudflareErrorMessage(decoded.Errors, "Cloudflare Stream could not create a live input"))
	}

	if strings.TrimSpace(decoded.Result.UID) == "" {
		return CloudflareLiveInput{}, errors.New("Cloudflare Stream returned an empty live input id")
	}

	return CloudflareLiveInput{
		UID:           strings.TrimSpace(decoded.Result.UID),
		RTMPSURL:      strings.TrimSpace(decoded.Result.RTMPS.URL),
		StreamKey:     strings.TrimSpace(decoded.Result.RTMPS.StreamKey),
		SRTURL:        strings.TrimSpace(decoded.Result.SRT.URL),
		SRTStreamID:   strings.TrimSpace(decoded.Result.SRT.StreamID),
		SRTPassphrase: strings.TrimSpace(decoded.Result.SRT.Passphrase),
	}, nil
}

func (c CloudflareStreamClient) DeleteLiveInput(ctx context.Context, liveInputID string) error {
	cleanID := strings.TrimSpace(liveInputID)
	if cleanID == "" {
		return nil
	}

	if !c.configured() {
		return ErrCloudflareNotConfigured
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/stream/live_inputs/%s", c.accountID, cleanID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("prepare cloudflare delete request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete cloudflare live input: %w", err)
	}
	defer res.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(res.Body, 1_000_000))
	if err != nil {
		return fmt.Errorf("read cloudflare delete response: %w", err)
	}

	if res.StatusCode == http.StatusNotFound {
		return nil
	}

	if len(responseBody) == 0 && res.StatusCode >= 200 && res.StatusCode <= 299 {
		return nil
	}

	var decoded cloudflareDeleteLiveInputResponse
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return fmt.Errorf("decode cloudflare delete response: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode > 299 || !decoded.Success {
		return fmt.Errorf("%s", cloudflareErrorMessage(decoded.Errors, "Cloudflare Stream could not delete the live input"))
	}

	return nil
}

func cloudflareErrorMessage(errors []cloudflareAPIError, fallback string) string {
	if len(errors) == 0 || strings.TrimSpace(errors[0].Message) == "" {
		return fallback
	}

	if errors[0].Code > 0 {
		return fmt.Sprintf("Cloudflare error %d: %s", errors[0].Code, errors[0].Message)
	}

	return errors[0].Message
}
