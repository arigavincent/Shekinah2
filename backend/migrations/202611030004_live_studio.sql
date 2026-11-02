-- +goose Up
-- Members-only broadcasts, and the studio setup for cameras, OBS and video
-- switchers: a fixed stream key (going live = pressing Start streaming), the
-- default title and who may watch, and an optional forward to YouTube.
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS members_only BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO app_settings (key, value)
VALUES ('live_studio', '{"cameraKey":"","title":"Live Service","membersOnly":false,"price":0,"forwardEnabled":false,"forwardUrl":""}')
ON CONFLICT (key) DO NOTHING;

-- +goose Down
DELETE FROM app_settings WHERE key = 'live_studio';
ALTER TABLE live_sessions DROP COLUMN IF EXISTS members_only;
