-- +goose Up
CREATE TABLE clips (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE downloads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    size TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prayers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    prayer_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE about_content (
    id TEXT PRIMARY KEY DEFAULT 'main',
    vision TEXT NOT NULL,
    description TEXT NOT NULL,
    contact_summary TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT about_content_singleton CHECK (id = 'main')
);

-- +goose Down
DROP TABLE IF EXISTS about_content;
DROP TABLE IF EXISTS prayers;
DROP TABLE IF EXISTS downloads;
DROP TABLE IF EXISTS clips;
