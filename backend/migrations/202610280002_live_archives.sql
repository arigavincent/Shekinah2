-- +goose Up
ALTER TABLE live_sessions ADD COLUMN recording_expected BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE live_archives (
 session_id TEXT PRIMARY KEY REFERENCES live_sessions(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready','failed')),
 object_key TEXT NOT NULL DEFAULT '', size_bytes BIGINT NOT NULL DEFAULT 0,
 attempts INT NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
 retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- +goose Down
DROP TABLE live_archives;
ALTER TABLE live_sessions DROP COLUMN recording_expected;
