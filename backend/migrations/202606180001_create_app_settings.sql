-- +goose Up
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES ('serve_whatsapp_number', '')
ON CONFLICT (key) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS app_settings;
