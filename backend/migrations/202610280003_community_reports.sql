-- +goose Up
CREATE TABLE community_reports (
 id BIGSERIAL PRIMARY KEY, message_id TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
 reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(message_id,reporter_id)
);
CREATE INDEX community_history_cursor ON community_messages(channel,created_at DESC,id DESC);
-- +goose Down
DROP TABLE community_reports;
DROP INDEX community_history_cursor;
