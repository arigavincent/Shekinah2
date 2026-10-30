package notifications

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type captureTransport func(*http.Request) (*http.Response, error)

func (f captureTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestFCMDestinationReachesForegroundAndColdIntent(t *testing.T) {
	var payload struct {
		Message struct {
			Data map[string]string `json:"data"`
		} `json:"message"`
	}
	client := &http.Client{Transport: captureTransport(func(r *http.Request) (*http.Response, error) {
		if e := json.NewDecoder(r.Body).Decode(&payload); e != nil {
			t.Fatal(e)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{}`)), Header: make(http.Header)}, nil
	})}
	sender := &fcmSender{client: client, account: &serviceAccount{ProjectID: "test"}, token: "test-token", expires: time.Now().Add(time.Hour)}
	success, failed, _ := sender.send(context.Background(), []string{"test-device"}, BroadcastRequest{Title: "Reading plan", Category: "devotion", Data: map[string]interface{}{"open": "plans", "id": "plan-123"}})
	if success != 1 || failed != 0 || payload.Message.Data["open"] != "plans" || payload.Message.Data["id"] != "plan-123" {
		t.Fatalf("FCM destination missing: %+v", payload.Message.Data)
	}
}
