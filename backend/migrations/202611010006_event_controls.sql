-- +goose Up
-- Registration deadline, cancelled events (kept for records) and voided registrations.
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_closes_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancel_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE event_registrations DROP COLUMN IF EXISTS issued_by, DROP COLUMN IF EXISTS voided_at;
ALTER TABLE events DROP COLUMN IF EXISTS cancel_reason, DROP COLUMN IF EXISTS cancelled_at, DROP COLUMN IF EXISTS registration_closes_at;
