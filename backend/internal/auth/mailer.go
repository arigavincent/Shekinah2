package auth

import (
	"context"
	"crypto/tls"
	"github.com/ariga/shekinah-backend/internal/mail"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"
)

type passwordResetMailer struct{ store mail.Store }

func (m passwordResetMailer) Send(email string, code string) error {
	config, _, err := m.store.Load(context.Background())
	if err != nil {
		return err
	}
	return mail.SendWithConfig(config, mail.Message{
		To:        []string{email},
		Subject:   "Your Shekinah password reset code",
		Heading:   "Reset your password",
		Intro:     "Use this code in the Shekinah Sons Global app (or the admin dashboard) to choose a new password.",
		Highlight: code,
		Footer:    "The code expires in 15 minutes. If you didn't ask to reset your password, you can ignore this email; your password stays the same.",
	})
}

func sendSMTP(addr string, host string, port string, auth smtp.Auth, from string, to []string, message []byte) error {
	timeout := timeDurationSeconds(envInt("SMTP_TIMEOUT_SECONDS", 10))

	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return err
	}

	var smtpConn net.Conn = conn

	if port == "465" {
		tlsConn := tls.Client(conn, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
		if err := tlsConn.Handshake(); err != nil {
			_ = conn.Close()
			return err
		}
		smtpConn = tlsConn
	}

	client, err := smtp.NewClient(smtpConn, host)
	if err != nil {
		_ = smtpConn.Close()
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

	if err := client.Mail(from); err != nil {
		return err
	}

	for _, recipient := range to {
		if err := client.Rcpt(recipient); err != nil {
			return err
		}
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}

	if _, err := writer.Write(message); err != nil {
		_ = writer.Close()
		return err
	}

	if err := writer.Close(); err != nil {
		return err
	}

	return client.Quit()
}

func timeDurationSeconds(seconds int) time.Duration {
	if seconds <= 0 {
		seconds = 10
	}
	return time.Duration(seconds) * time.Second
}

func env(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func envInt(key string, fallback int) int {
	value := env(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

// EmailReady reports whether outgoing email is set up, so staff are never
// told a code was sent when it could not be.
func (s Service) EmailReady(ctx context.Context) bool {
	config, _, err := s.mailer.store.Load(ctx)
	return err == nil && config.Configured()
}
