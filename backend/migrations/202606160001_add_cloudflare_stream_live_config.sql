-- +goose Up
ALTER TABLE live_stream_config
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'youtube',
    ADD COLUMN IF NOT EXISTS cloudflare_live_input_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cloudflare_playback_uid TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS playback_hls_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS playback_dash_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embed_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS rtmps_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS srt_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS srt_stream_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS stream_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS srt_passphrase TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS replay_url TEXT NOT NULL DEFAULT '';

UPDATE live_stream_config
SET id = 'main'
WHERE id = 'default'
  AND NOT EXISTS (
      SELECT 1
      FROM live_stream_config
      WHERE id = 'main'
  );

INSERT INTO live_stream_config (
    id,
    is_live,
    title,
    viewers,
    next_service,
    youtube_id,
    provider
)
VALUES (
    'main',
    FALSE,
    'Live Stream',
    '0',
    'Schedule will be updated soon.',
    '',
    'youtube'
)
ON CONFLICT (id) DO NOTHING;

-- +goose Down
ALTER TABLE live_stream_config
    DROP COLUMN IF EXISTS replay_url,
    DROP COLUMN IF EXISTS srt_passphrase,
    DROP COLUMN IF EXISTS stream_key,
    DROP COLUMN IF EXISTS srt_stream_id,
    DROP COLUMN IF EXISTS srt_url,
    DROP COLUMN IF EXISTS rtmps_url,
    DROP COLUMN IF EXISTS embed_url,
    DROP COLUMN IF EXISTS playback_dash_url,
    DROP COLUMN IF EXISTS playback_hls_url,
    DROP COLUMN IF EXISTS cloudflare_playback_uid,
    DROP COLUMN IF EXISTS cloudflare_live_input_id,
    DROP COLUMN IF EXISTS provider;
