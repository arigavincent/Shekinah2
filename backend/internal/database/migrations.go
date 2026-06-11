package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RunMigrations(ctx context.Context, db *pgxpool.Pool, dir string) error {
	if err := ensureMigrationTable(ctx, db); err != nil {
		return err
	}

	if err := bootstrapExistingDatabase(ctx, db); err != nil {
		return err
	}

	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return fmt.Errorf("find migrations: %w", err)
	}

	sort.Strings(files)

	for _, file := range files {
		version := filepath.Base(file)

		applied, err := migrationApplied(ctx, db, version)
		if err != nil {
			return err
		}

		if applied {
			continue
		}

		log.Printf("applying database migration %s", version)
		if err := applyMigration(ctx, db, version, file); err != nil {
			return err
		}
		log.Printf("applied database migration %s", version)
	}

	return nil
}

func ensureMigrationTable(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	return nil
}

func bootstrapExistingDatabase(ctx context.Context, db *pgxpool.Pool) error {
	var count int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		return fmt.Errorf("count schema migrations: %w", err)
	}

	if count > 0 {
		return nil
	}

	var exists bool
	if err := db.QueryRow(ctx, `SELECT to_regclass('public.sermons') IS NOT NULL`).Scan(&exists); err != nil {
		return fmt.Errorf("check existing schema: %w", err)
	}

	if !exists {
		return nil
	}

	// If a database was migrated before this lightweight runner existed, avoid
	// replaying CREATE TABLE migrations over existing content.
	rows, err := db.Query(ctx, `
		SELECT filename
		FROM (
			VALUES
				('202606040001_create_core_content_tables.sql'),
				('202606040002_seed_phase1_content.sql'),
				('202606040003_add_remaining_phase1_content.sql'),
				('202606040004_seed_remaining_phase1_content.sql'),
				('202606040005_create_users_table.sql'),
				('20260604235600_add_updated_at_to_updates.sql'),
				('202606050001_add_sermon_media_fields.sql'),
				('20260605090000_create_notification_tables.sql'),
				('20260605100000_create_giving_transactions.sql')
		) AS migrations(filename)
	`)
	if err != nil {
		return fmt.Errorf("prepare bootstrap migrations: %w", err)
	}
	defer rows.Close()

	batch := &pgx.Batch{}
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return fmt.Errorf("scan bootstrap migration: %w", err)
		}
		batch.Queue(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, filename)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate bootstrap migrations: %w", err)
	}

	results := db.SendBatch(ctx, batch)
	defer results.Close()

	for i := 0; i < batch.Len(); i++ {
		if _, err := results.Exec(); err != nil {
			return fmt.Errorf("insert bootstrap migration: %w", err)
		}
	}

	return nil
}

func migrationApplied(ctx context.Context, db *pgxpool.Pool, version string) (bool, error) {
	var exists bool
	err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check migration %s: %w", version, err)
	}

	return exists, nil
}

func applyMigration(ctx context.Context, db *pgxpool.Pool, version string, path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read migration %s: %w", version, err)
	}

	upSQL := upSQL(string(raw))
	if upSQL == "" {
		return fmt.Errorf("migration %s has no up statements", version)
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin migration %s: %w", version, err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, upSQL); err != nil {
		return fmt.Errorf("apply migration %s: %w", version, err)
	}

	if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
		return fmt.Errorf("record migration %s: %w", version, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migration %s: %w", version, err)
	}

	return nil
}

func upSQL(sql string) string {
	lines := strings.Split(sql, "\n")
	upLines := make([]string, 0, len(lines))
	inDown := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "-- +goose Down") {
			inDown = true
			continue
		}
		if strings.HasPrefix(trimmed, "-- +goose") {
			continue
		}
		if inDown {
			continue
		}
		upLines = append(upLines, line)
	}

	return strings.TrimSpace(strings.Join(upLines, "\n"))
}
