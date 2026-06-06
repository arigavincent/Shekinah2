-- +goose Up
CREATE TABLE IF NOT EXISTS giving_transactions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'mpesa',
    phone TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    checkout_request_id TEXT NOT NULL DEFAULT '',
    merchant_request_id TEXT NOT NULL DEFAULT '',
    mpesa_receipt_number TEXT NOT NULL DEFAULT '',
    result_code INTEGER,
    result_description TEXT NOT NULL DEFAULT '',
    provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giving_transactions_status
    ON giving_transactions(status);

CREATE INDEX IF NOT EXISTS idx_giving_transactions_checkout_request_id
    ON giving_transactions(checkout_request_id);

-- +goose Down
DROP TABLE IF EXISTS giving_transactions;
