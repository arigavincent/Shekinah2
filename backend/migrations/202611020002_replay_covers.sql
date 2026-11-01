-- +goose Up
-- Replays get a bright branded cover instead of a video frame. A cover an admin
-- uploads is kept; automatic ones are redrawn (e.g. after the title changes).
ALTER TABLE live_archives ADD COLUMN IF NOT EXISTS thumbnail_custom BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE live_archives ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
UPDATE live_archives SET thumbnail_url = '', thumbnail_attempts = 0 WHERE NOT thumbnail_custom;

-- +goose Down
ALTER TABLE live_archives DROP COLUMN IF EXISTS description;
ALTER TABLE live_archives DROP COLUMN IF EXISTS thumbnail_custom;
