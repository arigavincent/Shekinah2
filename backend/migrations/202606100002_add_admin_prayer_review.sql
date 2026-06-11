ALTER TABLE prayers
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE prayers
SET
	status = COALESCE(NULLIF(TRIM(status), ''), 'new'),
	admin_note = COALESCE(admin_note, '')
WHERE status IS NULL
   OR TRIM(status) = ''
   OR admin_note IS NULL;

CREATE INDEX IF NOT EXISTS idx_prayers_status_created_at
	ON prayers (status, created_at DESC);
