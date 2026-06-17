-- +goose Up
CREATE TABLE IF NOT EXISTS reading_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    duration_days INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reading_plan_days (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    reference TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    prayer_prompt TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_reading_plan_days_plan_id_day_number
    ON reading_plan_days(plan_id, day_number);

CREATE TABLE IF NOT EXISTS reading_plan_progress (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, user_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_reading_plan_progress_user_id_plan_id
    ON reading_plan_progress(user_id, plan_id);

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_plan_reminders_user_id_plan_id
    ON reading_plan_reminders(user_id, plan_id);

-- +goose Down
DROP TABLE IF EXISTS reading_plan_reminders;
DROP TABLE IF EXISTS reading_plan_notes;
