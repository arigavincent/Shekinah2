-- +goose Up
INSERT INTO clips (id, title, image_url) VALUES
(
    'clip-1',
    'Faith Speaks Before It Sees',
    'https://images.unsplash.com/photo-1445232867465-97891f9b5294?q=80&w=700'
),
(
    'clip-2',
    'Prayer Changes Atmospheres',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=700'
),
(
    'clip-3',
    'Carry The Fire Daily',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=700'
)
ON CONFLICT (id) DO UPDATE SET
title = EXCLUDED.title,
image_url = EXCLUDED.image_url,
updated_at = now();

INSERT INTO downloads (id, title, size, image_url) VALUES
(
    'dl-1',
    'Grace For The New Season',
    '62 MB',
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=700'
),
(
    'dl-2',
    'Building Altars Of Prayer',
    '118 MB',
    'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900'
)
ON CONFLICT (id) DO UPDATE SET
title = EXCLUDED.title,
size = EXCLUDED.size,
image_url = EXCLUDED.image_url,
updated_at = now();

INSERT INTO prayers (id, name, text, prayer_date, count) VALUES
(
    'pr-1',
    'Anonymous',
    'Pray with me for healing and renewed strength.',
    'Today',
    24
),
(
    'pr-2',
    'Mary',
    'Believing God for a new job and direction.',
    'Yesterday',
    18
)
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
text = EXCLUDED.text,
prayer_date = EXCLUDED.prayer_date,
count = EXCLUDED.count;

INSERT INTO about_content (
    id,
    vision,
    description,
    contact_summary
) VALUES
(
    'main',
    'To raise a generation that walks in the presence of God, lives by the word, and carries the light of Christ into families, cities, and nations.',
    'Shekinah Sons Global is a Christ-centered ministry devoted to worship, prayer, discipleship, and the teaching of God’s word. This app exists to help members and friends stay connected to sermons, devotions, live services, events, prayer, and church updates.',
    'Visit one of our branches, follow our platforms, or connect with the church through the contact details provided in the app.'
)
ON CONFLICT (id) DO UPDATE SET
vision = EXCLUDED.vision,
description = EXCLUDED.description,
contact_summary = EXCLUDED.contact_summary,
updated_at = now();

-- +goose Down
DELETE FROM about_content WHERE id = 'main';

DELETE FROM prayers WHERE id IN ('pr-1', 'pr-2');

DELETE FROM downloads WHERE id IN ('dl-1', 'dl-2');

DELETE FROM clips WHERE id IN ('clip-1', 'clip-2', 'clip-3');
