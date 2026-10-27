-- +goose Up
-- A testimony can be shared without the member's name (admins still see it).
ALTER TABLE testimonies ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE testimonies DROP COLUMN IF EXISTS is_anonymous;
