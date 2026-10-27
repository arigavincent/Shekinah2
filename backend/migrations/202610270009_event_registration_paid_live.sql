-- +goose Up
-- Events can take registrations: none, an in-app form (custom questions) or
-- an outside form link (e.g. Google Forms); they can be free or paid.
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS registration TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS form_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS form_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS event_registrations (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    ticket TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

-- A live can be paid: viewers get access once their payment is confirmed.
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE live_sessions DROP COLUMN IF EXISTS price;
DROP TABLE IF EXISTS event_registrations;
ALTER TABLE events DROP COLUMN IF EXISTS capacity, DROP COLUMN IF EXISTS price, DROP COLUMN IF EXISTS form_fields,
    DROP COLUMN IF EXISTS form_url, DROP COLUMN IF EXISTS registration;
