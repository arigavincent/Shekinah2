// Package webhooks delivers signed event notifications to addresses a super
// admin registered. Deliveries run in the background and never slow the
// request that caused them.
package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Events a webhook can subscribe to.
var Events = []string{"member.created", "member.updated", "giving.received", "giving.refunded", "attendance.session.created", "event.registered", "user.suspended", "user.deleted"}

var pool *pgxpool.Pool

// Start enables delivery; without it Emit does nothing (tests, tools). It also
// drains the outbox that database triggers fill for payments, refunds, new
// members and event registrations.
func Start(ctx context.Context, db *pgxpool.Pool) {
	pool = db
	go func() {
		tick := time.NewTicker(5 * time.Second)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				drainOutbox(ctx)
			}
		}
	}()
}

func drainOutbox(ctx context.Context) {
	rows, err := pool.Query(ctx, `DELETE FROM webhook_outbox WHERE id IN (SELECT id FROM webhook_outbox ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED) RETURNING event,payload`)
	if err != nil {
		return
	}
	type item struct {
		event string
		data  map[string]any
	}
	var items []item
	for rows.Next() {
		var it item
		if rows.Scan(&it.event, &it.data) == nil {
			items = append(items, it)
		}
	}
	rows.Close()
	for _, it := range items {
		Emit(it.event, it.data)
	}
}

// Only public internet addresses: never this server, the private network or
// cloud metadata, even when a domain name resolves to one of them.
var client = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		Proxy: nil,
		DialContext: (&net.Dialer{Timeout: 5 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			ip := net.ParseIP(host)
			if ip == nil || !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				return errors.New("webhook address is not on the public internet")
			}
			return nil
		}}).DialContext,
	},
	CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
}

// ValidURL accepts only https addresses with a host name.
func ValidURL(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	return err == nil && u.Scheme == "https" && u.Host != "" && u.User == nil
}

func NewSecret() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return "whsec_" + hex.EncodeToString(b)
}

// Emit notifies every active webhook subscribed to the event.
func Emit(event string, data map[string]any) {
	if pool == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()
		rows, err := pool.Query(ctx, `SELECT id,url,secret FROM webhooks WHERE is_active AND $1=ANY(events)`, event)
		if err != nil {
			return
		}
		type hook struct{ id, url, secret string }
		var hooks []hook
		for rows.Next() {
			var h hook
			if rows.Scan(&h.id, &h.url, &h.secret) == nil {
				hooks = append(hooks, h)
			}
		}
		rows.Close()
		for _, h := range hooks {
			Deliver(ctx, h.id, h.url, h.secret, event, data)
		}
	}()
}

// Deliver sends one event and records the outcome; it returns the HTTP status
// (0 when the address could not be reached).
func Deliver(ctx context.Context, id, address, secret, event string, data map[string]any) int {
	body, _ := json.Marshal(map[string]any{"event": event, "createdAt": time.Now().UTC().Format(time.RFC3339), "data": data})
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	status := 0
	if ValidURL(address) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, address, bytes.NewReader(body))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("User-Agent", "Shekinah-Webhooks/1")
			req.Header.Set("X-Shekinah-Event", event)
			req.Header.Set("X-Shekinah-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
			if res, err := client.Do(req); err == nil {
				status = res.StatusCode
				res.Body.Close()
			} else {
				log.Printf("webhook %s: %v", id, err)
			}
		}
	}
	if pool != nil {
		_, _ = pool.Exec(context.Background(), `UPDATE webhooks SET last_status=$2,last_triggered_at=NOW() WHERE id=$1`, id, status)
	}
	return status
}
