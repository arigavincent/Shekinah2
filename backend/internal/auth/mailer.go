package auth

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strconv"
	"strings"
)

type passwordResetMailer struct{}

func (m passwordResetMailer) Send(email string, code string) error {
	from := env("SMTP_FROM")
	host := env("SMTP_HOST")
	port := env("SMTP_PORT")
	username := env("SMTP_USERNAME")
	password := env("SMTP_PASSWORD")

	if host == "" || port == "" || from == "" {
		log.Printf("password reset OTP for %s: %s", email, code)
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

	if err := smtp.SendMail(addr, auth, from, []string{email}, []byte(message)); err != nil {
		return fmt.Errorf("send password reset email: %w", err)
	}

	return nil
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
