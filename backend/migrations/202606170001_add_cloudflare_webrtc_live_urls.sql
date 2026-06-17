ALTER TABLE live_stream_config
  ADD COLUMN IF NOT EXISTS webrtc_publish_url TEXT NOT NULL DEFAULT '';

ALTER TABLE live_stream_config
  ADD COLUMN IF NOT EXISTS webrtc_playback_url TEXT NOT NULL DEFAULT '';
