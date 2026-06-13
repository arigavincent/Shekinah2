-- +goose Up
UPDATE live_stream_config
SET
    is_live = false,
    title = 'Live Stream',
    viewers = '0',
    next_service = CASE
        WHEN trim(next_service) = '' THEN 'Schedule will be updated soon.'
        ELSE next_service
    END,
    youtube_id = CASE
        WHEN youtube_id = 'jfKfPfyJRdk' THEN ''
        ELSE youtube_id
    END,
    updated_at = now()
WHERE id = 'main'
  AND title = 'Sunday Celebration Service'
  AND viewers = '1,284'
  AND youtube_id = 'jfKfPfyJRdk';

-- +goose Down
UPDATE live_stream_config
SET
    is_live = true,
    title = 'Sunday Celebration Service',
    viewers = '1,284',
    next_service = 'Sunday, 9:00 AM',
    youtube_id = 'jfKfPfyJRdk',
    updated_at = now()
WHERE id = 'main'
  AND title = 'Live Stream'
  AND viewers = '0';
