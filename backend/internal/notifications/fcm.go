package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Sends pushes to the native Android app through Firebase Cloud Messaging
// (HTTP v1), signing in with the Firebase project's service account. Set
// FCM_SERVICE_ACCOUNT_FILE (a path) or FCM_SERVICE_ACCOUNT_JSON (the JSON).

type serviceAccount struct {
	ProjectID   string `json:"project_id"`
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

type fcmSender struct {
	account *serviceAccount
	client  *http.Client
	mu      sync.Mutex
	token   string
	expires time.Time
}

func newFCMSender(client *http.Client) *fcmSender {
	raw := strings.TrimSpace(os.Getenv("FCM_SERVICE_ACCOUNT_JSON"))
	if path := strings.TrimSpace(os.Getenv("FCM_SERVICE_ACCOUNT_FILE")); raw == "" && path != "" {
		if data, err := os.ReadFile(path); err == nil {
			raw = string(data)
		}
	}
	if raw == "" {
		return &fcmSender{client: client}
	}
	var account serviceAccount
	if err := json.Unmarshal([]byte(raw), &account); err != nil || account.ProjectID == "" || account.PrivateKey == "" {
		return &fcmSender{client: client}
	}
	if account.TokenURI == "" {
		account.TokenURI = "https://oauth2.googleapis.com/token"
	}
	return &fcmSender{account: &account, client: client}
}

func (s *fcmSender) configured() bool { return s != nil && s.account != nil }

func (s *fcmSender) accessToken(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.token != "" && time.Now().Before(s.expires) {
		return s.token, nil
	}
	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(s.account.PrivateKey))
	if err != nil {
		return "", fmt.Errorf("fcm private key: %w", err)
	}
	now := time.Now()
	assertion, err := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss":   s.account.ClientEmail,
		"scope": "https://www.googleapis.com/auth/firebase.messaging",
		"aud":   s.account.TokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	}).SignedString(key)
	if err != nil {
		return "", err
	}
	form := url.Values{"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"}, "assertion": {assertion}}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, s.account.TokenURI, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || out.AccessToken == "" {
		return "", errors.New("fcm: could not get an access token")
	}
	s.token = out.AccessToken
	s.expires = now.Add(time.Duration(out.ExpiresIn-120) * time.Second)
	return s.token, nil
}

// send delivers one message per device; returns delivered and failed counts
// plus the tokens Firebase says are no longer valid.
func (s *fcmSender) send(ctx context.Context, tokens []string, req BroadcastRequest) (int, int, []string) {
	if len(tokens) == 0 {
		return 0, 0, nil
	}
	if !s.configured() {
		return 0, len(tokens), nil
	}
	access, err := s.accessToken(ctx)
	if err != nil {
		return 0, len(tokens), nil
	}
	endpoint := "https://fcm.googleapis.com/v1/projects/" + s.account.ProjectID + "/messages:send"
	data := map[string]string{"category": req.Category, "title": req.Title, "body": req.Body}
	if payload, err := json.Marshal(req.Data); err == nil {
		data["payload"] = string(payload)
	}
	success, failure := 0, 0
	stale := []string{}
	for _, token := range tokens {
		body, _ := json.Marshal(map[string]any{
			"message": map[string]any{
				"token":        token,
				"notification": map[string]string{"title": req.Title, "body": req.Body},
				"data":         data,
				"android": map[string]any{
					"priority":     "high",
					"notification": map[string]string{"channel_id": channelFor(req.Category), "color": "#D4AF37"},
				},
			},
		})
		httpReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		httpReq.Header.Set("Authorization", "Bearer "+access)
		httpReq.Header.Set("Content-Type", "application/json")
		resp, err := s.client.Do(httpReq)
		if err != nil {
			failure++
			continue
		}
		resp.Body.Close()
		switch {
		case resp.StatusCode >= 200 && resp.StatusCode < 300:
			success++
		case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusBadRequest:
			failure++
			stale = append(stale, token)
		default:
			failure++
		}
	}
	return success, failure, stale
}

// The Android notification channel each category posts to (the app creates them).
func channelFor(category string) string {
	switch category {
	case "live", "sermons", "devotion", "events":
		return category
	default:
		return "general"
	}
}
