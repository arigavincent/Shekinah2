-- +goose Up
ALTER TABLE clips
ADD COLUMN IF NOT EXISTS media_url TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS duration TEXT NOT NULL DEFAULT '';

INSERT INTO clips (id, title, image_url, media_url, duration) VALUES
(
    'clip-zXKCTnNFgwU',
    '2025 Highlight',
    'https://i.ytimg.com/vi/zXKCTnNFgwU/hqdefault.jpg',
    'https://www.youtube.com/watch?v=zXKCTnNFgwU',
    '1:15'
),
(
    'clip-zMKSJPNeIdc',
    'Generation Gather - November Edition',
    'https://i.ytimg.com/vi/zMKSJPNeIdc/hqdefault.jpg',
    'https://www.youtube.com/watch?v=zMKSJPNeIdc',
    '1:31'
),
(
    'clip-xndGDMTco7U',
    'Life As A Son Of God Recap',
    'https://i.ytimg.com/vi/xndGDMTco7U/hqdefault.jpg',
    'https://www.youtube.com/watch?v=xndGDMTco7U',
    '8:21'
),
(
    'clip-5aPZqmTNCAU',
    'November Endmonth Event Invitation',
    'https://i.ytimg.com/vi/5aPZqmTNCAU/hqdefault.jpg',
    'https://www.youtube.com/watch?v=5aPZqmTNCAU',
    '1:13'
),
(
    'clip-jxRTo57d4zY',
    'Small Things Matters Recap',
    'https://i.ytimg.com/vi/jxRTo57d4zY/hqdefault.jpg',
    'https://www.youtube.com/watch?v=jxRTo57d4zY',
    '9:57'
),
(
    'clip-ax6Qu4Ok2uY',
    'Jesus 006 - The Person Of The Holy Spirit',
    'https://i.ytimg.com/vi/ax6Qu4Ok2uY/hqdefault.jpg',
    'https://www.youtube.com/watch?v=ax6Qu4Ok2uY',
    '13:50'
),
(
    'clip--3pSs4zM8u4',
    'Shekinah Sons 6th Anniversary Recap',
    'https://i.ytimg.com/vi/-3pSs4zM8u4/hqdefault.jpg',
    'https://www.youtube.com/watch?v=-3pSs4zM8u4',
    '11:33'
),
(
    'clip-L0Df46lo8mI',
    'Redeemed Future Highlights',
    'https://i.ytimg.com/vi/L0Df46lo8mI/hqdefault.jpg',
    'https://www.youtube.com/watch?v=L0Df46lo8mI',
    '1:38'
),
(
    'clip-Pb2UWuJfiWE',
    'Being Committed To Become',
    'https://i.ytimg.com/vi/Pb2UWuJfiWE/hqdefault.jpg',
    'https://www.youtube.com/watch?v=Pb2UWuJfiWE',
    '8:21'
),
(
    'clip-XMlKSE-07Ak',
    'The Message Of Sonship Of 2025',
    'https://i.ytimg.com/vi/XMlKSE-07Ak/hqdefault.jpg',
    'https://www.youtube.com/watch?v=XMlKSE-07Ak',
    '11:47'
)
ON CONFLICT (id) DO UPDATE SET
title = EXCLUDED.title,
image_url = EXCLUDED.image_url,
media_url = EXCLUDED.media_url,
duration = EXCLUDED.duration,
updated_at = now();

-- +goose Down
DELETE FROM clips
WHERE id IN (
    'clip-zXKCTnNFgwU',
    'clip-zMKSJPNeIdc',
    'clip-xndGDMTco7U',
    'clip-5aPZqmTNCAU',
    'clip-jxRTo57d4zY',
    'clip-ax6Qu4Ok2uY',
    'clip--3pSs4zM8u4',
    'clip-L0Df46lo8mI',
    'clip-Pb2UWuJfiWE',
    'clip-XMlKSE-07Ak'
);
