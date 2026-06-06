-- +goose Up
ALTER TABLE updates
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- +goose Down
ALTER TABLE updates
DROP COLUMN IF EXISTS updated_at;
