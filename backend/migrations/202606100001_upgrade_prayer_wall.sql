-- +goose Up
ALTER TABLE prayers
    ADD COLUMN category TEXT NOT NULL DEFAULT 'Personal',
    ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN owner_email TEXT NOT NULL DEFAULT '',
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE prayers
SET category = CASE
        WHEN name = 'Anonymous' THEN 'Healing'
        ELSE 'Provision'
    END,
    is_public = TRUE,
    updated_at = created_at
WHERE category = 'Personal' AND owner_user_id IS NULL;

CREATE TABLE prayer_prays (
    prayer_id TEXT NOT NULL REFERENCES prayers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (prayer_id, user_id)
);

CREATE INDEX idx_prayers_public_created_at ON prayers (is_public, created_at DESC);
CREATE INDEX idx_prayers_owner_user_id ON prayers (owner_user_id, created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_prayers_owner_user_id;
DROP INDEX IF EXISTS idx_prayers_public_created_at;
DROP TABLE IF EXISTS prayer_prays;

ALTER TABLE prayers
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS owner_email,
    DROP COLUMN IF EXISTS owner_user_id,
    DROP COLUMN IF EXISTS is_public,
    DROP COLUMN IF EXISTS category;
