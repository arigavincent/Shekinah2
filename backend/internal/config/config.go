package config

import (
	"os"
	"strings"
)

type Config struct {
	AppEnv                 string
	HTTPAddr               string
	DatabaseURL            string
	JWTSecret              string
	APIBibleKey            string
	APIBibleBaseURL        string
	FlutterwaveSecretKey   string
	FlutterwaveBaseURL     string
	FlutterwaveRedirectURL string
	AllowedOrigins         []string
}

func Load() Config {
	return Config{
		AppEnv:                 getEnv("APP_ENV", "development"),
		HTTPAddr:               httpAddr(),
		DatabaseURL:            getEnv("DATABASE_URL", "postgres://shekinah:shekinah@localhost:5432/shekinah?sslmode=disable"),
		JWTSecret:              getEnv("JWT_SECRET", "dev-only-change-this-secret"),
		APIBibleKey:            getEnv("API_BIBLE_KEY", ""),
		APIBibleBaseURL:        getEnv("API_BIBLE_BASE_URL", "https://rest.api.bible/v1"),
		FlutterwaveSecretKey:   getEnv("FLUTTERWAVE_SECRET_KEY", ""),
		FlutterwaveBaseURL:     getEnv("FLUTTERWAVE_BASE_URL", "https://developersandbox-api.flutterwave.com"),
		FlutterwaveRedirectURL: getEnv("FLUTTERWAVE_REDIRECT_URL", "https://example.com/giving/flutterwave/return"),
		AllowedOrigins: splitCSV(getEnv(
			"ALLOWED_ORIGINS",
			"http://localhost:5173,http://127.0.0.1:5173",
		)),
	}
}

func httpAddr() string {
	if value := os.Getenv("HTTP_ADDR"); value != "" {
		return value
	}

	if port := os.Getenv("PORT"); port != "" {
		return ":" + port
	}

	return ":3000"
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	clean := make([]string, 0, len(parts))

	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		clean = append(clean, item)
	}

	return clean
}
