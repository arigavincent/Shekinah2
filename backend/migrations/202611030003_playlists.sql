-- +goose Up
-- Playlists of sermons: members' own (saved to their account so they move
-- with them to a new phone) and official ones the church publishes, e.g. a
-- sermon series. Items are sermon ids in play order.
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    official BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    items TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (official OR owner_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists (owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_official ON playlists (official, updated_at DESC) WHERE official;

-- +goose Down
DROP TABLE IF EXISTS playlists;
