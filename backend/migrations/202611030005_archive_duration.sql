-- +goose Up
-- Length of a recording made on the video server (cameras, OBS, phones over
-- RTMP), measured from the finished file. Direct-to-storage recordings keep
-- using their segment lengths.
ALTER TABLE live_archives ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE live_archives DROP COLUMN IF EXISTS duration_seconds;
