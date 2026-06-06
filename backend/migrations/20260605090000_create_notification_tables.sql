-- +goose Up
CREATE TABLE IF NOT EXISTS notification_devices (
    id TEXT PRIMARY KEY,
    expo_push_token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT '',
    device_name TEXT NOT NULL DEFAULT '',
    app_version TEXT NOT NULL DEFAULT '',
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_enabled
    ON notification_devices(enabled);

CREATE TABLE IF NOT EXISTS notification_messages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS notification_messages;
DROP TABLE IF EXISTS notification_devices;
