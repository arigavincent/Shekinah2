-- +goose Up
INSERT INTO sermon_categories (id, name, image_url) VALUES
('cat-youtube-teachings', 'Teachings', 'https://i.ytimg.com/vi/asQFM1unI8Q/hqdefault.jpg'),
('cat-youtube-sonship', 'Sonship', 'https://i.ytimg.com/vi/xndGDMTco7U/hqdefault.jpg')
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
    'yt-asQFM1unI8Q',
    'video',
    'WHY JESUS CHRIST CAME AND DIED',
    'Sir Joseph Mash',
    '2026-06-01',
    'cat-youtube-teachings',
    false,
    'https://i.ytimg.com/vi/asQFM1unI8Q/hqdefault.jpg',
    '22:47',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=asQFM1unI8Q'
),
(
    'yt-zQvxJFkFXC8',
    'video',
    'TAKE RESPONSIBILITY!',
    'Sir Joseph Mash',
    '2026-05-31',
    'cat-youtube-teachings',
    false,
    'https://i.ytimg.com/vi/zQvxJFkFXC8/hqdefault.jpg',
    '20:52',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=zQvxJFkFXC8'
),
(
    'yt-AFIkyeAcRwE',
    'video',
    'THE SIMPLICITY IN CHRIST JESUS',
    'Sir Joseph Mash',
    '2026-05-30',
    'cat-youtube-teachings',
    false,
    'https://i.ytimg.com/vi/AFIkyeAcRwE/hqdefault.jpg',
    '12:11',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=AFIkyeAcRwE'
),
(
    'yt-NDC2E4YkHEM',
    'video',
    '2 DAYS OF LIGHT',
    'Sir Joseph Mash & Prophet Josphiah',
    '2026-05-29',
    'cat-youtube-teachings',
    false,
    'https://i.ytimg.com/vi/NDC2E4YkHEM/hqdefault.jpg',
    '11:21',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=NDC2E4YkHEM'
),
(
    'yt-kyUeStQaaRM',
    'video',
    'WHAT YOU ARE MADE OF',
    'Sir Joseph Mash',
    '2026-05-28',
    'cat-youtube-teachings',
    false,
    'https://i.ytimg.com/vi/kyUeStQaaRM/hqdefault.jpg',
    '21:18',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=kyUeStQaaRM'
),
(
    'yt-LKZTLv7VEwo',
    'video',
    'THE HOPE OF OUR CALLING',
    'Sir Joseph Mash',
    '2026-05-27',
    'cat-youtube-teachings',
    false,
    'https://i.ytimg.com/vi/LKZTLv7VEwo/hqdefault.jpg',
    '21:00',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=LKZTLv7VEwo'
),
(
    'yt-CjddPxMCCDk',
    'video',
    'THE LIFE OF FAITH',
    'Shekinah Sons Global',
    '2026-05-26',
    'cat-1',
    false,
    'https://i.ytimg.com/vi/CjddPxMCCDk/hqdefault.jpg',
    '11:01',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=CjddPxMCCDk'
),
(
    'yt-IN_seTRPh9o',
    'video',
    'REDEEMED FUTURE SERIES',
    'Shekinah Sons Global',
    '2026-05-25',
    'cat-youtube-sonship',
    false,
    'https://i.ytimg.com/vi/IN_seTRPh9o/hqdefault.jpg',
    '19:05',
    'A Shekinah Sons Global teaching from the official YouTube channel.',
    'https://www.youtube.com/watch?v=IN_seTRPh9o'
),
(
    'yt-xndGDMTco7U',
    'video',
    'LIFE AS A SON OF GOD RECAP',
    'Shekinah Sons Global',
    '2026-05-24',
    'cat-youtube-sonship',
    false,
    'https://i.ytimg.com/vi/xndGDMTco7U/hqdefault.jpg',
    '8:21',
    'A Shekinah Sons Global teaching recap from the official YouTube channel.',
    'https://www.youtube.com/watch?v=xndGDMTco7U'
),
(
    'yt-jxRTo57d4zY',
    'video',
    'Small Things Matters Recap',
    'Sir Joseph Mash',
    '2025-11-06',
    'cat-youtube-teachings',
    false,
    'https://i.ytimg.com/vi/jxRTo57d4zY/hqdefault.jpg',
    '9:57',
    'A Shekinah Sons Global teaching recap from the official YouTube channel.',
    'https://www.youtube.com/watch?v=jxRTo57d4zY'
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

-- +goose Down
DELETE FROM sermons
WHERE id IN (
    'yt-asQFM1unI8Q',
    'yt-zQvxJFkFXC8',
    'yt-AFIkyeAcRwE',
    'yt-NDC2E4YkHEM',
    'yt-kyUeStQaaRM',
    'yt-LKZTLv7VEwo',
    'yt-CjddPxMCCDk',
    'yt-IN_seTRPh9o',
    'yt-xndGDMTco7U',
    'yt-jxRTo57d4zY'
);

DELETE FROM sermon_categories
WHERE id IN ('cat-youtube-teachings', 'cat-youtube-sonship');
