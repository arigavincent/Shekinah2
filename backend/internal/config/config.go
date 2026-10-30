package config

import (
	"net/http"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Optional dependency injection for isolated provider tests; never set from HTTP input.
	ProviderHTTPClient                       *http.Client
	AppEnv                                   string
	HTTPAddr                                 string
	DatabaseURL                              string
	JWTSecret                                string
	APIBibleKey                              string
	APIBibleBaseURL                          string
	FlutterwaveSecretKey                     string
	FlutterwaveBaseURL                       string
	FlutterwaveRedirectURL                   string
	CloudflareAccountID                      string
	CloudflareStreamAPIToken                 string
	CloudflareStreamRecordingMode            string
	CloudflareStreamDeleteRecordingAfterDays int
	AllowedOrigins                           []string
}

func Load() Config {
	return Config{
		AppEnv:                                   getEnv("APP_ENV", "development"),
		HTTPAddr:                                 httpAddr(),
		DatabaseURL:                              getEnv("DATABASE_URL", "postgres://shekinah:shekinah@localhost:5432/shekinah?sslmode=disable"),
		JWTSecret:                                getEnv("JWT_SECRET", "dev-only-change-this-secret"),
		APIBibleKey:                              getEnv("API_BIBLE_KEY", ""),
		APIBibleBaseURL:                          getEnv("API_BIBLE_BASE_URL", "https://rest.api.bible/v1"),
		FlutterwaveSecretKey:                     getEnv("FLUTTERWAVE_SECRET_KEY", ""),
		FlutterwaveBaseURL:                       getEnv("FLUTTERWAVE_BASE_URL", "https://api.flutterwave.com/v3"),
		FlutterwaveRedirectURL:                   getEnv("FLUTTERWAVE_REDIRECT_URL", ""),
		CloudflareAccountID:                      getEnv("CLOUDFLARE_ACCOUNT_ID", ""),
		CloudflareStreamAPIToken:                 getEnv("CLOUDFLARE_STREAM_API_TOKEN", ""),
		CloudflareStreamRecordingMode:            getEnv("CLOUDFLARE_STREAM_RECORDING_MODE", "automatic"),
		CloudflareStreamDeleteRecordingAfterDays: getEnvInt("CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS", 0),
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

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
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
