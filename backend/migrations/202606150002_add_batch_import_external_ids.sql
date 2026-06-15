-- +goose Up

ALTER TABLE sermons
    ADD COLUMN IF NOT EXISTS external_id TEXT;

UPDATE sermons
SET external_id = COALESCE(NULLIF(external_id, ''), id);

ALTER TABLE sermons
    ALTER COLUMN external_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sermons_external_id_key
    ON sermons(external_id);

ALTER TABLE devotions
    ADD COLUMN IF NOT EXISTS external_id TEXT;

UPDATE devotions
SET external_id = COALESCE(NULLIF(external_id, ''), id);

ALTER TABLE devotions
    ALTER COLUMN external_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devotions_external_id_key
    ON devotions(external_id);

-- +goose Down

DROP INDEX IF EXISTS devotions_external_id_key;
ALTER TABLE devotions
    DROP COLUMN IF EXISTS external_id;

DROP INDEX IF EXISTS sermons_external_id_key;
ALTER TABLE sermons
    DROP COLUMN IF EXISTS external_id;
