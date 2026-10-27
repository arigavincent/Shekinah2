-- +goose Up
-- Devices can now be native Android phones on Firebase Cloud Messaging as
-- well as the old Expo app.
ALTER TABLE notification_devices ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'expo';

-- +goose Down
ALTER TABLE notification_devices DROP COLUMN IF EXISTS provider;
