-- +goose Up
ALTER TABLE live_archives ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NOT NULL DEFAULT '';
ALTER TABLE live_archives ADD COLUMN IF NOT EXISTS thumbnail_attempts INT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE live_archives DROP COLUMN IF EXISTS thumbnail_attempts, DROP COLUMN IF EXISTS thumbnail_url;
