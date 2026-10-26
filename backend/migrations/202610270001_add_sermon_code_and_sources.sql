-- +goose Up
-- code: short label the app's artwork template renders (e.g. "S.14").
-- source: where the media lives: manual URL, a Cloudflare Stream upload, a
-- recorded live service, or an episode synced from a podcast RSS feed.
-- stream_uid: Cloudflare Stream video id for uploads and live recordings.
-- status: Stream uploads stay "processing" until Cloudflare finishes encoding.
ALTER TABLE sermons
    ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS stream_uid TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready';

ALTER TABLE sermons
    ADD CONSTRAINT sermons_source_check CHECK (source IN ('manual', 'cloudflare_stream', 'live_recording', 'podcast')),
    ADD CONSTRAINT sermons_status_check CHECK (status IN ('processing', 'ready', 'error'));

CREATE UNIQUE INDEX IF NOT EXISTS sermons_stream_uid_unique
    ON sermons(stream_uid)
    WHERE stream_uid <> '';

INSERT INTO app_settings (key, value)
VALUES ('podcast_feed_url', '')
ON CONFLICT (key) DO NOTHING;

-- +goose Down
DELETE FROM app_settings WHERE key = 'podcast_feed_url';
DROP INDEX IF EXISTS sermons_stream_uid_unique;
ALTER TABLE sermons
    DROP CONSTRAINT IF EXISTS sermons_status_check,
    DROP CONSTRAINT IF EXISTS sermons_source_check,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS stream_uid,
    DROP COLUMN IF EXISTS source,
    DROP COLUMN IF EXISTS code;
