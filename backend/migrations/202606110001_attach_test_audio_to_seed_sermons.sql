UPDATE sermons
SET
	media_url = '/uploads/media/shekinah-grace-for-the-new-season-test.mp3',
	duration = '1:15',
	description = CASE
		WHEN description ILIKE '%temporary local test audio%' THEN description
		ELSE CONCAT(description, ' Temporary local test audio attached for app playback verification.')
	END,
	updated_at = now()
WHERE id = 'ser-3'
  AND COALESCE(TRIM(media_url), '') = '';

UPDATE sermons
SET
	media_url = '/uploads/media/shekinah-the-sound-of-revival-test.mp3',
	duration = '1:30',
	description = CASE
		WHEN description ILIKE '%temporary local test audio%' THEN description
		ELSE CONCAT(description, ' Temporary local test audio attached for app playback verification.')
	END,
	updated_at = now()
WHERE id = 'ser-4'
  AND COALESCE(TRIM(media_url), '') = '';
