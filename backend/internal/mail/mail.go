// Package mail sends the church's emails (password reset codes, serve
// requests) through the SMTP server set in the environment, as a branded
// HTML message with a plain-text copy. Without SMTP settings it logs the
// message instead, so nothing is lost while testing.
package mail

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"html"
	"log"
	"mime"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// Row is a labelled line in the message, e.g. "Phone: 0712 345 678".
type Row struct{ Label, Value string }

type Message struct {
	To      []string
	ReplyTo string
	Subject string
	Heading string
	Intro   string
	Rows    []Row
	// Big, centred text such as a reset code.
	Highlight string
	Footer    string
}

func env(key string) string { return strings.TrimSpace(os.Getenv(key)) }

// Configured reports whether emails actually go out.
func Configured() bool { return env("SMTP_HOST") != "" && env("SMTP_PORT") != "" && env("SMTP_FROM") != "" }

func Send(m Message) error {
	to := make([]string, 0, len(m.To))
	for _, t := range m.To {
		if t = strings.TrimSpace(t); t != "" {
			to = append(to, t)
		}
	}
	if len(to) == 0 {
		return fmt.Errorf("no recipients")
	}
	text := plain(m)
	if !Configured() {
		log.Printf("email not sent (SMTP not configured) to=%s subject=%q\n%s", strings.Join(to, ","), m.Subject, text)
		return nil
	}
	host, port, from := env("SMTP_HOST"), env("SMTP_PORT"), env("SMTP_FROM")
	var auth smtp.Auth
	if u, p := env("SMTP_USERNAME"), env("SMTP_PASSWORD"); u != "" || p != "" {
		auth = smtp.PlainAuth("", u, p, host)
	}
	boundary := randomHex(12)
	headers := []string{
		"From: " + from,
		"To: " + strings.Join(to, ", "),
		"Subject: " + mime.QEncoding.Encode("utf-8", m.Subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
		`Content-Type: multipart/alternative; boundary="` + boundary + `"`,
	}
	if m.ReplyTo != "" {
		headers = append(headers, "Reply-To: "+m.ReplyTo)
	}
	body := strings.Join(headers, "\r\n") + "\r\n\r\n" +
		"--" + boundary + "\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + text + "\r\n" +
		"--" + boundary + "\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" + htmlBody(m) + "\r\n" +
		"--" + boundary + "--\r\n"
	if err := send(host, port, auth, from, to, []byte(body)); err != nil {
		log.Printf("email send failed to=%s subject=%q error=%v", strings.Join(to, ","), m.Subject, err)
		return err
	}
	return nil
}

func plain(m Message) string {
	var b strings.Builder
	b.WriteString(m.Heading + "\n\n")
	if m.Intro != "" {
		b.WriteString(m.Intro + "\n\n")
	}
	if m.Highlight != "" {
		b.WriteString("    " + m.Highlight + "\n\n")
	}
	for _, r := range m.Rows {
		b.WriteString(r.Label + ": " + r.Value + "\n")
	}
	if m.Footer != "" {
		b.WriteString("\n" + m.Footer + "\n")
	}
	b.WriteString("\nShekinah Sons Global\n")
	return b.String()
}

func htmlBody(m Message) string {
	e := html.EscapeString
	var rows strings.Builder
	for _, r := range m.Rows {
		rows.WriteString(`<tr><td style="padding:8px 0;color:#8a8a90;font-size:13px;width:38%;vertical-align:top">` + e(r.Label) +
			`</td><td style="padding:8px 0;color:#f2f2f4;font-size:15px">` + strings.ReplaceAll(e(r.Value), "\n", "<br>") + `</td></tr>`)
	}
	highlight := ""
	if m.Highlight != "" {
		highlight = `<div style="margin:22px 0;padding:18px;border-radius:14px;background:#1e1a10;border:1px solid #6b5310;text-align:center;font-size:32px;letter-spacing:8px;font-weight:700;color:#f0d27a">` + e(m.Highlight) + `</div>`
	}
	footer := ""
	if m.Footer != "" {
		footer = `<p style="color:#8a8a90;font-size:13px;line-height:20px;margin:22px 0 0">` + e(m.Footer) + `</p>`
	}
	table := ""
	if rows.Len() > 0 {
		table = `<table style="width:100%;border-collapse:collapse;margin-top:14px;border-top:1px solid #2a2a2e">` + rows.String() + `</table>`
	}
	return `<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 18px">
<div style="text-align:center;padding-bottom:18px"><span style="font-size:20px;letter-spacing:4px;font-weight:700;color:#d4af37">SHEKINAH</span><br><span style="font-size:10px;letter-spacing:4px;color:#b8b8bd">SONS GLOBAL</span></div>
<div style="background:#151517;border:1px solid #2a2a2e;border-radius:20px;padding:26px">
<div style="height:4px;width:48px;border-radius:2px;background:linear-gradient(90deg,#f0d27a,#a8841f);margin-bottom:16px"></div>
<h1 style="margin:0 0 10px;color:#ffffff;font-size:22px">` + e(m.Heading) + `</h1>
<p style="margin:0;color:#c9c9ce;font-size:15px;line-height:23px">` + strings.ReplaceAll(e(m.Intro), "\n", "<br>") + `</p>` + highlight + table + footer + `
</div><p style="text-align:center;color:#5c5c62;font-size:12px;margin-top:18px">Sent by the Shekinah Sons Global app</p></div></body></html>`
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func send(host, port string, auth smtp.Auth, from string, to []string, message []byte) error {
	conn, err := net.DialTimeout("tcp", host+":"+port, 12*time.Second)
	if err != nil {
		return err
	}
	var c net.Conn = conn
	if port == "465" {
		t := tls.Client(conn, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
		if err := t.Handshake(); err != nil {
			_ = conn.Close()
			return err
		}
		c = t
	}
	client, err := smtp.NewClient(c, host)
	if err != nil {
		_ = c.Close()
		return err
	}
	defer client.Close()
	if port != "465" {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
				return err
			}
		}
	}
	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(auth); err != nil {
				return err
			}
		}
	}
	if err := client.Mail(addressOnly(from)); err != nil {
		return err
	}
	for _, r := range to {
		if err := client.Rcpt(r); err != nil {
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(message); err != nil {
		_ = w.Close()
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

// "Shekinah <no-reply@x.org>" -> "no-reply@x.org"
func addressOnly(from string) string {
	if i := strings.Index(from, "<"); i >= 0 {
		return strings.Trim(from[i:], "<> ")
	}
	return from
}
