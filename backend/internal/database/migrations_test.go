package database

import (
	"strings"
	"testing"
)

func TestUpSQLKeepsSemicolonsInsideQuotedStrings(t *testing.T) {
	raw := `
-- +goose Up
INSERT INTO devotions (body) VALUES ('The Lord calls; He equips.');

UPDATE users SET updated_at = now();

-- +goose Down
DELETE FROM devotions;
`

	got := upSQL(raw)

	if !strings.Contains(got, "The Lord calls; He equips.") {
		t.Fatalf("expected quoted semicolon to be preserved, got %q", got)
	}

	if strings.Contains(got, "DELETE FROM devotions") {
		t.Fatalf("expected down migration to be excluded, got %q", got)
	}
}

func TestUpSQLIgnoresGooseDirectives(t *testing.T) {
	raw := `
-- +goose Up
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
`

	got := upSQL(raw)

	if strings.Contains(got, "+goose") {
		t.Fatalf("expected goose directives to be stripped, got %q", got)
	}

	if got != "SELECT 1;" {
		t.Fatalf("expected only SQL body, got %q", got)
	}
}
