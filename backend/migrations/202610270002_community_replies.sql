-- +goose Up
-- WhatsApp-style replies: a message can quote an earlier one.
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES community_messages(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE community_messages DROP COLUMN IF EXISTS reply_to_id;
