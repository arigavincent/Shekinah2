-- +goose Up
-- Ticket tiers (e.g. VIP and Regular), each with its own price and places.
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS tier_id TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE event_registrations DROP COLUMN IF EXISTS tier_id;
ALTER TABLE events DROP COLUMN IF EXISTS ticket_tiers;
