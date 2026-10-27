-- +goose Up
-- Ministry books, journals and materials: free or priced, stored encrypted.
ALTER TABLE library_items
    ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'book',
    ADD COLUMN IF NOT EXISTS file_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE library_items ALTER COLUMN file_url SET DEFAULT '';

-- A book bought through the giving payment flow.
ALTER TABLE giving_transactions ADD COLUMN IF NOT EXISTS item_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_giving_transactions_item ON giving_transactions(item_id, user_id) WHERE item_id <> '';

-- +goose Down
DROP INDEX IF EXISTS idx_giving_transactions_item;
ALTER TABLE giving_transactions DROP COLUMN IF EXISTS item_id;
ALTER TABLE library_items DROP COLUMN IF EXISTS is_published, DROP COLUMN IF EXISTS published_by,
    DROP COLUMN IF EXISTS file_key, DROP COLUMN IF EXISTS kind, DROP COLUMN IF EXISTS price;
