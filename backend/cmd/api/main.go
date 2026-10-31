package main

import (
	"context"
	"encoding/base64"
	"errors"
	"github.com/ariga/shekinah-backend/internal/webhooks"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/database"
	"github.com/ariga/shekinah-backend/internal/server"
)

func main() {
	cfg := config.Load()
	if cfg.AppEnv == "production" && (len(cfg.JWTSecret) < 32 || cfg.JWTSecret == "dev-only-change-this-secret") {
		log.Fatal("Set JWT_SECRET to a strong secret of at least 32 characters before starting production")
	}

	if cfg.AppEnv == "production" {
		key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(os.Getenv("LIBRARY_ENCRYPTION_KEY")))
		if err != nil || len(key) != 32 {
			log.Fatal("Set LIBRARY_ENCRYPTION_KEY to a persistent base64-encoded 32-byte key before production startup")
		}
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	if err := database.BootstrapFromR2(ctx, db); err != nil {
		log.Fatal(err)
	}
	if err := database.RunMigrations(ctx, db, "migrations"); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}

	if cfg.AppEnv == "production" {
		if err := database.CheckProductionAccounts(ctx, db); err != nil {
			log.Fatal(err)
		}
	}
	webhooks.Start(ctx, db)
	app := server.NewWithContext(ctx, cfg, db)
	server.StartBackground(ctx, cfg, db)

	httpServer := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           app,
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErrors := make(chan error, 1)

	go func() {
		log.Printf("Shekinah API listening on %s", cfg.HTTPAddr)

		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
			return
		}

		serverErrors <- nil
	}()

	select {
	case err := <-serverErrors:
		if err != nil {
			log.Fatalf("server failed: %v", err)
		}

	case <-ctx.Done():
		log.Println("shutdown signal received")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("graceful shutdown failed: %v", err)
		}

		log.Println("server stopped")
	}
}
