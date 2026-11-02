-- +goose Up
-- Notes that go with a sermon: key points, scriptures and anything else the
-- preacher wants members to keep. The sermon's description is its overview.
CREATE TABLE IF NOT EXISTS sermon_notes (
    sermon_id TEXT PRIMARY KEY,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS sermon_notes;
