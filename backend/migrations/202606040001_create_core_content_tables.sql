-- +goose Up
CREATE TABLE sermon_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sermons (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('video', 'audio')),
    title TEXT NOT NULL,
    speaker TEXT NOT NULL,
    sermon_date DATE NOT NULL,
    category_id TEXT REFERENCES sermon_categories(id) ON DELETE SET NULL,
    is_live BOOLEAN NOT NULL DEFAULT false,
    thumbnail_url TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    media_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sermons_type_idx ON sermons(type);
CREATE INDEX sermons_category_id_idx ON sermons(category_id);
CREATE INDEX sermons_sermon_date_idx ON sermons(sermon_date DESC);

CREATE TABLE devotions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    devotion_date DATE NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX devotions_devotion_date_idx ON devotions(devotion_date DESC);

CREATE TABLE scriptures (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    verse TEXT NOT NULL,
    reference TEXT NOT NULL,
    scripture_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scriptures_scripture_date_idx ON scriptures(scripture_date DESC);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_time TEXT NOT NULL,
    location TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_event_date_idx ON events(event_date ASC);

CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    services TEXT NOT NULL,
    phone TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE updates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    update_date DATE NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX updates_update_date_idx ON updates(update_date DESC);

CREATE TABLE platforms (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('Web', 'TV', 'Radio')),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX platforms_type_idx ON platforms(type);

CREATE TABLE live_stream_config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    is_live BOOLEAN NOT NULL DEFAULT false,
    title TEXT NOT NULL,
    viewers TEXT NOT NULL DEFAULT '0',
    next_service TEXT NOT NULL,
    youtube_id TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT live_stream_singleton CHECK (id = 'main')
);

-- +goose Down
DROP TABLE IF EXISTS live_stream_config;
DROP TABLE IF EXISTS platforms;
DROP TABLE IF EXISTS updates;
DROP TABLE IF EXISTS branches;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS scriptures;
DROP TABLE IF EXISTS devotions;
DROP TABLE IF EXISTS sermons;
DROP TABLE IF EXISTS sermon_categories;
