package auth

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"
)

type passwordResetMailer struct{}

func (m passwordResetMailer) Send(email string, code string) error {
	from := env("SMTP_FROM")
	host := env("SMTP_HOST")
	port := env("SMTP_PORT")
	username := env("SMTP_USERNAME")
	password := env("SMTP_PASSWORD")

	if host == "" || port == "" || from == "" {
		log.Printf("password reset SMTP not configured; OTP for %s: %s", email, code)
		return nil
	}

	subject := "Shekinah password reset code"
	body := fmt.Sprintf(
		"Your Shekinah password reset code is %s.\n\nThis code expires in 15 minutes. If you did not request this, ignore this email.\n",
		code,
	)

	message := strings.Join([]string{
		"From: " + from,
		"To: " + email,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	addr := host + ":" + port
	var auth smtp.Auth
	if username != "" || password != "" {
		auth = smtp.PlainAuth("", username, password, host)
	}

	log.Printf("password reset SMTP send start to=%s host=%s port=%s from=%s username_set=%t password_set=%t", email, host, port, from, username != "", password != "")

	if err := sendSMTP(addr, host, port, auth, from, []string{email}, []byte(message)); err != nil {
		log.Printf("password reset SMTP send failed to=%s host=%s port=%s error=%v; OTP for manual testing: %s", email, host, port, err, code)
		return fmt.Errorf("send password reset email: %w", err)
	}

	log.Printf("password reset SMTP send success to=%s host=%s port=%s", email, host, port)
	return nil
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
