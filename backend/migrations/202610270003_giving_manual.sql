-- +goose Up
-- Paybill and bank giving: who paid (as typed in the app) for finance to match.
ALTER TABLE giving_transactions ADD COLUMN IF NOT EXISTS payer_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_giving_transactions_method_reference ON giving_transactions(method, provider_reference);

-- +goose Down
DROP INDEX IF EXISTS idx_giving_transactions_method_reference;
ALTER TABLE giving_transactions DROP COLUMN IF EXISTS payer_name;
