-- +goose Up
INSERT INTO sermon_categories (id, name, image_url) VALUES
('cat-1', 'Faith', 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900'),
('cat-2', 'Prayer', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=700'),
('cat-3', 'Grace', 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=700'),
('cat-4', 'Revival', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=700')
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
image_url = EXCLUDED.image_url,
updated_at = now();

INSERT INTO sermons (
    id,
    type,
    title,
    speaker,
    sermon_date,
    category_id,
    is_live,
    thumbnail_url,
    duration,
    description,
    media_url
) VALUES
(
    'ser-1',
    'video',
    'The Power Of A Consecrated Life',
    'Shekinah Sons Global',
    '2026-06-02',
    'cat-1',
    true,
    'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900',
    '',
    'A message on living set apart for God, carrying spiritual discipline into daily life, and building a consistent walk with Christ.',
    ''
),
(
    'ser-2',
    'video',
    'Building Altars Of Prayer',
    'Shekinah Sons Global',
    '2026-05-29',
    'cat-2',
    false,
    'https://images.unsplash.com/photo-1519682337058-a94d519337bc?q=80&w=900',
    '',
    'A teaching on prayer, consistency, and creating a life that hosts the presence of God.',
    ''
),
(
    'ser-3',
    'audio',
    'Grace For The New Season',
    'Shekinah Sons Global',
    '2026-05-26',
    'cat-3',
    false,
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=700',
    '54:20',
    'An audio sermon on discerning seasons and moving with the wisdom of God.',
    ''
),
(
    'ser-4',
    'audio',
    'The Sound Of Revival',
    'Shekinah Sons Global',
    '2026-05-20',
    'cat-4',
    false,
    'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?q=80&w=900',
    '47:08',
    'A stirring message on hunger, worship, and the move of God among His people.',
    ''
)
ON CONFLICT (id) DO UPDATE SET
type = EXCLUDED.type,
title = EXCLUDED.title,
speaker = EXCLUDED.speaker,
sermon_date = EXCLUDED.sermon_date,
category_id = EXCLUDED.category_id,
is_live = EXCLUDED.is_live,
thumbnail_url = EXCLUDED.thumbnail_url,
duration = EXCLUDED.duration,
description = EXCLUDED.description,
media_url = EXCLUDED.media_url,
updated_at = now();

INSERT INTO devotions (
    id,
    title,
    excerpt,
    devotion_date,
    image_url,
    body
) VALUES
(
    'dev-1',
    'Walking In The Light Of God',
    'A reminder to stand in faith and let the word of God shape your day.',
    '2026-06-04',
    'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=600',
    'God calls His people to walk in light, confidence, and obedience. Today, choose to let the word of God guide your thoughts, your speech, and your decisions. Faith is not passive. It is a daily walk.'
),
(
    'dev-2',
    'Strength For The Assignment',
    'The grace of God gives strength for every responsibility placed before you.',
    '2026-06-03',
    'https://images.unsplash.com/photo-1475785584197-7726ac74ebf2?q=80&w=700',
    'There is an assignment attached to your life. The Lord does not only call; He equips. Lean on His grace and continue faithfully in what He has placed in your hands.'
),
(
    'dev-3',
    'A Heart That Seeks God',
    'A seeking heart is never empty; it is continually filled by the Spirit.',
    '2026-06-02',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=700',
    'The hunger for God is a holy invitation. Keep your heart open, your worship sincere, and your attention fixed on Him.'
)
ON CONFLICT (id) DO UPDATE SET
title = EXCLUDED.title,
excerpt = EXCLUDED.excerpt,
devotion_date = EXCLUDED.devotion_date,
image_url = EXCLUDED.image_url,
body = EXCLUDED.body,
updated_at = now();

INSERT INTO scriptures (
    id,
    title,
    verse,
    reference,
    scripture_date
) VALUES
(
    'scr-1',
    'Scripture of the Day',
    'The Lord is my light and my salvation; whom shall I fear?',
    'Psalm 27:1',
    '2026-06-04'
)
ON CONFLICT (id) DO UPDATE SET
title = EXCLUDED.title,
verse = EXCLUDED.verse,
reference = EXCLUDED.reference,
scripture_date = EXCLUDED.scripture_date;

INSERT INTO events (
    id,
    title,
    event_date,
    event_time,
    location,
    image_url,
    description
) VALUES
(
    'evt-1',
    'Night Of Worship',
    '2026-06-14',
    '6:00 PM',
    'Main Sanctuary',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=900',
    'An evening of worship, prayer, and the ministry of the word.'
),
(
    'evt-2',
    'Youth Ablaze Conference',
    '2026-06-21',
    '10:00 AM',
    'Shekinah City Campus',
    'https://images.unsplash.com/photo-1515169067865-5387ec356754?q=80&w=900',
    'A youth gathering focused on purpose, purity, and spiritual fire.'
),
(
    'evt-3',
    'Prayer And Fasting Week',
    '2026-07-01',
    '5:30 AM',
    'All Branches',
    'https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=900',
    'A week of corporate prayer and consecration.'
)
ON CONFLICT (id) DO UPDATE SET
title = EXCLUDED.title,
event_date = EXCLUDED.event_date,
event_time = EXCLUDED.event_time,
location = EXCLUDED.location,
image_url = EXCLUDED.image_url,
description = EXCLUDED.description,
updated_at = now();

INSERT INTO branches (
    id,
    name,
    address,
    services,
    phone,
    latitude,
    longitude,
    image_url
) VALUES
(
    'br-1',
    'Shekinah Sons Global - Main Campus',
    'Nairobi, Kenya',
    'Sunday Celebration Service: 9:00 AM · Midweek Service: Wednesday 5:30 PM',
    '+254 700 000 000',
    -1.286389,
    36.817223,
    'https://images.unsplash.com/photo-1519491050282-cf00c82424b4?q=80&w=900'
),
(
    'br-2',
    'Shekinah Sons Global - City Campus',
    'Nairobi City Campus, Kenya',
    'Sunday Service: 11:30 AM · Prayer Meeting: Friday 6:00 PM',
    '+254 711 000 000',
    -1.2644,
    36.8028,
    'https://images.unsplash.com/photo-1519491050282-cf00c82424b4?q=80&w=900'
)
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
address = EXCLUDED.address,
services = EXCLUDED.services,
phone = EXCLUDED.phone,
latitude = EXCLUDED.latitude,
longitude = EXCLUDED.longitude,
image_url = EXCLUDED.image_url,
updated_at = now();

INSERT INTO updates (
    id,
    title,
    excerpt,
    update_date,
    image_url
) VALUES
(
    'up-1',
    'Midweek Service Update',
    'Join us this Wednesday evening for worship, prayer, and the ministry of the word.',
    '2026-06-04',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=900'
),
(
    'up-2',
    'Prayer Points',
    'This week we are praying for families, healing, spiritual growth, and national peace.',
    '2026-06-03',
    'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=600'
)
ON CONFLICT (id) DO UPDATE SET
title = EXCLUDED.title,
excerpt = EXCLUDED.excerpt,
update_date = EXCLUDED.update_date,
image_url = EXCLUDED.image_url;

INSERT INTO platforms (
    id,
    type,
    name,
    description,
    link
) VALUES
(
    'web-1',
    'Web',
    'Official Website',
    'Access sermons, church updates, giving information, and ministry resources online.',
    'https://example.com'
),
(
    'tv-1',
    'TV',
    'Shekinah TV',
    'Watch selected teachings, worship moments, service highlights, and ministry broadcasts.',
    ''
),
(
    'radio-1',
    'Radio',
    'Shekinah Radio',
    'Listen to devotionals, prayers, and faith-building messages throughout the week.',
    ''
)
ON CONFLICT (id) DO UPDATE SET
type = EXCLUDED.type,
name = EXCLUDED.name,
description = EXCLUDED.description,
link = EXCLUDED.link,
updated_at = now();

INSERT INTO live_stream_config (
    id,
    is_live,
    title,
    viewers,
    next_service,
    youtube_id
) VALUES
(
    'main',
    false,
    'Live Stream',
    '0',
    'Sunday, 9:00 AM',
    ''
)
ON CONFLICT (id) DO UPDATE SET
is_live = EXCLUDED.is_live,
title = EXCLUDED.title,
viewers = EXCLUDED.viewers,
next_service = EXCLUDED.next_service,
youtube_id = EXCLUDED.youtube_id,
updated_at = now();

-- +goose Down
DELETE FROM live_stream_config WHERE id = 'main';

DELETE FROM platforms WHERE id IN ('web-1', 'tv-1', 'radio-1');

DELETE FROM updates WHERE id IN ('up-1', 'up-2');

DELETE FROM branches WHERE id IN ('br-1', 'br-2');

DELETE FROM events WHERE id IN ('evt-1', 'evt-2', 'evt-3');

DELETE FROM scriptures WHERE id = 'scr-1';

DELETE FROM devotions WHERE id IN ('dev-1', 'dev-2', 'dev-3');

DELETE FROM sermons WHERE id IN ('ser-1', 'ser-2', 'ser-3', 'ser-4');

DELETE FROM sermon_categories WHERE id IN ('cat-1', 'cat-2', 'cat-3', 'cat-4');
