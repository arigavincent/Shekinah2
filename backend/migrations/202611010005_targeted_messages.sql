-- +goose Up
-- Push devices belong to the signed-in member, so messages can reach a group.
ALTER TABLE notification_devices ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notification_devices_user ON notification_devices(user_id);
-- Sent log: who a message went to and through which channels. A NULL audience
-- means everyone; otherwise only those members see it in their feed.
ALTER TABLE notification_messages ADD COLUMN IF NOT EXISTS audience UUID[];
ALTER TABLE notification_messages ADD COLUMN IF NOT EXISTS audience_label TEXT NOT NULL DEFAULT 'Everyone';
ALTER TABLE notification_messages ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notification_messages ADD COLUMN IF NOT EXISTS channels TEXT[] NOT NULL DEFAULT '{push}';
ALTER TABLE notification_messages ADD COLUMN IF NOT EXISTS email_count INT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE notification_messages DROP COLUMN IF EXISTS email_count, DROP COLUMN IF EXISTS channels,
    DROP COLUMN IF EXISTS sent_by, DROP COLUMN IF EXISTS audience_label, DROP COLUMN IF EXISTS audience;
DROP INDEX IF EXISTS idx_notification_devices_user;
ALTER TABLE notification_devices DROP COLUMN IF EXISTS user_id;
