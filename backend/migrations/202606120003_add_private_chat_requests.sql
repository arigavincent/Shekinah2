-- +goose Up

CREATE TABLE IF NOT EXISTS private_chat_requests (
    id TEXT PRIMARY KEY,
    pair_key TEXT NOT NULL UNIQUE,
    requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_private_chat_requests_requester
    ON private_chat_requests(requester_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_chat_requests_recipient
    ON private_chat_requests(recipient_user_id, status, updated_at DESC);

-- +goose Down

DROP TABLE IF EXISTS private_chat_requests;
