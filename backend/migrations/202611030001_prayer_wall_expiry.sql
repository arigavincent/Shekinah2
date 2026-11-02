-- +goose Up
-- Prayer requests leave the public wall after a set number of days (30 by
-- default). The member can keep one up for another period or mark it
-- answered; the pastoral team can pin one. Hidden requests are deleted a year
-- after they left the wall.
ALTER TABLE prayers
    ADD COLUMN IF NOT EXISTS shown_from TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
UPDATE prayers SET shown_from = created_at WHERE shown_from IS NULL;
ALTER TABLE prayers ALTER COLUMN shown_from SET DEFAULT now(), ALTER COLUMN shown_from SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prayers_wall ON prayers (is_public, shown_from DESC);
INSERT INTO app_settings (key, value) VALUES ('prayer_wall_days', '30') ON CONFLICT (key) DO NOTHING;

-- +goose Down
DROP INDEX IF EXISTS idx_prayers_wall;
ALTER TABLE prayers DROP COLUMN IF EXISTS reminded_at, DROP COLUMN IF EXISTS answered_at, DROP COLUMN IF EXISTS pinned, DROP COLUMN IF EXISTS shown_from;
DELETE FROM app_settings WHERE key = 'prayer_wall_days';
