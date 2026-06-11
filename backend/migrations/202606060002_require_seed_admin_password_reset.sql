-- +goose Up
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT false;

UPDATE users
SET password_reset_required = true,
    updated_at = now()
WHERE email = 'vincent@example.com';

-- +goose Down
UPDATE users
SET password_reset_required = false,
    updated_at = now()
WHERE email = 'vincent@example.com';
