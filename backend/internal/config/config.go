package config

import "os"

type Config struct {
	AppEnv      string
	HTTPAddr    string
	DatabaseURL string
	JWTSecret   string
}

func Load() Config {
	return Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		HTTPAddr:    httpAddr(),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://shekinah:shekinah@localhost:5432/shekinah?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-only-change-this-secret"),
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
