-- +goose Up
CREATE TABLE upload_sessions (
 id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
 file_name TEXT NOT NULL, size_bytes BIGINT NOT NULL CHECK(size_bytes>0), offset_bytes BIGINT NOT NULL DEFAULT 0,
 content_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', public_url TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX upload_sessions_owner ON upload_sessions(owner_id,updated_at);
-- +goose Down
DROP TABLE upload_sessions;
