-- +goose Up

ALTER TABLE giving_transactions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KES',
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mpesa',
    ADD COLUMN IF NOT EXISTS checkout_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_reference TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS card_brand TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS card_last4 TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_giving_transactions_user_id
    ON giving_transactions(user_id);

CREATE TABLE IF NOT EXISTS community_messages (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'global' CHECK (channel IN ('global', 'live')),
    display_name TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'hidden')),
    hidden_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_channel_status_created_at
    ON community_messages(channel, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_messages_user_id_created_at
    ON community_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS testimonies (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    like_count INTEGER NOT NULL DEFAULT 0,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonies_status_featured_created_at
    ON testimonies(status, featured DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS testimony_likes (
    id TEXT PRIMARY KEY,
    testimony_id TEXT NOT NULL REFERENCES testimonies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (testimony_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_testimony_likes_testimony_id
    ON testimony_likes(testimony_id);

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

CREATE TABLE IF NOT EXISTS member_checkin_codes (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_checkins (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'manual')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_checkins_event_id_created_at
    ON event_checkins(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_checkins_user_id_created_at
    ON event_checkins(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bible_version_installs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'api.bible',
    version_id TEXT NOT NULL,
    language_code TEXT NOT NULL,
    language_name TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'installed' CHECK (status IN ('installed', 'removed')),
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider, version_id)
);

CREATE INDEX IF NOT EXISTS idx_bible_version_installs_user_id
    ON bible_version_installs(user_id);

INSERT INTO community_messages (id, user_id, channel, display_name, message, status)
SELECT
    'chat-welcome-global',
    u.id,
    'global',
    'Shekinah Team',
    'Welcome to the Shekinah community chat. Keep the conversation respectful and centered on Christ.',
    'approved'
FROM users u
WHERE u.email = 'vincent@example.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_messages (id, user_id, channel, display_name, message, status)
SELECT
    'chat-welcome-live',
    u.id,
    'live',
    'Shekinah Team',
    'Live service chat is open. Share short responses, prayer points, and encouragement.',
    'approved'
FROM users u
WHERE u.email = 'vincent@example.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO reading_plans (id, title, description, image_url, duration_days, is_active)
VALUES (
    'plan-7day-prayer-revival',
    '7 Days of Prayer and Revival',
    'A one-week guided plan with scripture, reflection, and prayer prompts for personal revival.',
    'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=1200',
    7,
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    duration_days = EXCLUDED.duration_days,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO reading_plan_days (id, plan_id, day_number, title, reference, description, prayer_prompt)
VALUES
    ('plan-7day-day-1', 'plan-7day-prayer-revival', 1, 'Return to the Secret Place', 'Matthew 6:6', 'Jesus calls us back to private prayer and honest communion with the Father.', 'Lord, restore delight in secret prayer and help me seek You with sincerity.'),
    ('plan-7day-day-2', 'plan-7day-prayer-revival', 2, 'Renew the Mind', 'Romans 12:2', 'Transformation begins when the Word reforms our thinking.', 'Lord, renew my mind and align my desires with Your will.'),
    ('plan-7day-day-3', 'plan-7day-prayer-revival', 3, 'Walk in the Spirit', 'Galatians 5:16', 'The Spirit leads us away from the flesh and into holy fruitfulness.', 'Holy Spirit, lead my choices, speech, and desires today.'),
    ('plan-7day-day-4', 'plan-7day-prayer-revival', 4, 'Stand in Faith', 'Hebrews 11:6', 'Faith pleases God and anchors us when results are delayed.', 'Father, strengthen my trust where I have grown tired or uncertain.'),
    ('plan-7day-day-5', 'plan-7day-prayer-revival', 5, 'Pursue Holiness', '1 Peter 1:15-16', 'Holiness is not legalism; it is wholehearted belonging to God.', 'Lord, separate my life for Your purpose and cleanse every compromise.'),
    ('plan-7day-day-6', 'plan-7day-prayer-revival', 6, 'Carry One Another', 'Galatians 6:2', 'We grow stronger when we intercede, serve, and carry burdens together.', 'Teach me to be faithful in prayer and practical love for others.'),
    ('plan-7day-day-7', 'plan-7day-prayer-revival', 7, 'Go in Power', 'Acts 1:8', 'Revival is not only personal renewal but Spirit-empowered witness.', 'Jesus, fill me with courage and power to witness where You have placed me.')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    reference = EXCLUDED.reference,
    description = EXCLUDED.description,
    prayer_prompt = EXCLUDED.prayer_prompt,
    updated_at = NOW();

-- +goose Down

DROP TABLE IF EXISTS bible_version_installs;
DROP TABLE IF EXISTS event_checkins;
DROP TABLE IF EXISTS member_checkin_codes;
DROP TABLE IF EXISTS reading_plan_progress;
DROP TABLE IF EXISTS reading_plan_days;
DROP TABLE IF EXISTS reading_plans;
DROP TABLE IF EXISTS testimony_likes;
DROP TABLE IF EXISTS testimonies;
DROP TABLE IF EXISTS community_messages;

ALTER TABLE giving_transactions
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS currency,
    DROP COLUMN IF EXISTS provider,
    DROP COLUMN IF EXISTS checkout_url,
    DROP COLUMN IF EXISTS provider_reference,
    DROP COLUMN IF EXISTS card_brand,
    DROP COLUMN IF EXISTS card_last4;
