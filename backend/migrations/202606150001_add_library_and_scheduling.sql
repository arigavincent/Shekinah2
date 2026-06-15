-- +goose Up

ALTER TABLE sermons
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE sermons
SET published_at = COALESCE(
    published_at,
    sermon_date::timestamp AT TIME ZONE 'UTC'
);

ALTER TABLE sermons
    ALTER COLUMN published_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS sermons_published_at_idx
    ON sermons(published_at DESC);

ALTER TABLE devotions
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE devotions
SET published_at = COALESCE(
    published_at,
    devotion_date::timestamp AT TIME ZONE 'UTC'
);

ALTER TABLE devotions
    ALTER COLUMN published_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS devotions_published_at_idx
    ON devotions(published_at DESC);

CREATE TABLE IF NOT EXISTS library_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'pdf',
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_items_published_at
    ON library_items(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_items_category
    ON library_items(category);

CREATE TABLE IF NOT EXISTS reading_plan_notes (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, user_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_reading_plan_notes_user_id_plan_id
    ON reading_plan_notes(user_id, plan_id);

CREATE TABLE IF NOT EXISTS reading_plan_reminders (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_time TEXT NOT NULL DEFAULT '06:00',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_plan_reminders_user_id_plan_id
    ON reading_plan_reminders(user_id, plan_id);

-- +goose Down

DROP TABLE IF EXISTS reading_plan_reminders;
DROP TABLE IF EXISTS reading_plan_notes;
DROP TABLE IF EXISTS library_items;

DROP INDEX IF EXISTS devotions_published_at_idx;
ALTER TABLE devotions
    DROP COLUMN IF EXISTS published_at;

DROP INDEX IF EXISTS sermons_published_at_idx;
ALTER TABLE sermons
    DROP COLUMN IF EXISTS published_at;
