-- +goose Up
-- What an admin has allowed a member to do: 'live:broadcast', 'live:moderate', 'books:publish'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- One row per broadcast from the app.
CREATE TABLE IF NOT EXISTS live_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    broadcaster_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stream_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'starting' CHECK (status IN ('starting', 'live', 'ended')),
    peak_viewers INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

-- Live chat: pinned messages, who said it (host / moderator badges).
ALTER TABLE community_messages
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS badge TEXT NOT NULL DEFAULT '';

-- Members a moderator has stopped from chatting.
CREATE TABLE IF NOT EXISTS chat_bans (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES ('live_chat', '{"slowModeSeconds":0,"bannedWords":[]}')
ON CONFLICT (key) DO NOTHING;

-- +goose Down
DELETE FROM app_settings WHERE key = 'live_chat';
DROP TABLE IF EXISTS chat_bans;
ALTER TABLE community_messages DROP COLUMN IF EXISTS badge, DROP COLUMN IF EXISTS pinned;
DROP TABLE IF EXISTS live_sessions;
ALTER TABLE users DROP COLUMN IF EXISTS permissions;
