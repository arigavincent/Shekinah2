-- +goose Up

CREATE TABLE IF NOT EXISTS private_chat_devices (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    identity_public_key TEXT NOT NULL,
    signing_public_key TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_private_chat_devices_active
    ON private_chat_devices(user_id, active, updated_at DESC);

CREATE TABLE IF NOT EXISTS private_chat_threads (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct')),
    pair_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS private_chat_thread_members (
    thread_id TEXT NOT NULL REFERENCES private_chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_message_id TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_private_chat_thread_members_user
    ON private_chat_thread_members(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS private_chat_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES private_chat_threads(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    sender_ephemeral_public_key TEXT NOT NULL,
    sender_copy_ciphertext TEXT NOT NULL DEFAULT '',
    sender_copy_nonce TEXT NOT NULL DEFAULT '',
    signature TEXT NOT NULL DEFAULT '',
    recipient_device_id TEXT NOT NULL DEFAULT '',
    protocol_version TEXT NOT NULL DEFAULT 'e2ee-v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_private_chat_messages_thread_created
    ON private_chat_messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_private_chat_messages_sender_created
    ON private_chat_messages(sender_user_id, created_at DESC);

-- +goose Down

DROP TABLE IF EXISTS private_chat_messages;
DROP TABLE IF EXISTS private_chat_thread_members;
DROP TABLE IF EXISTS private_chat_threads;
DROP TABLE IF EXISTS private_chat_devices;
