-- +goose Up
-- Two-step sign-in (authenticator app codes) and staff idle sign-out.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_step BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_active_at TIMESTAMPTZ;
-- MFA was a display-only flag before; nobody has a secret, so nobody has MFA yet.
UPDATE users SET mfa_enabled = FALSE WHERE mfa_secret = '';

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS staff_active_at, DROP COLUMN IF EXISTS mfa_last_step,
    DROP COLUMN IF EXISTS mfa_pending_secret, DROP COLUMN IF EXISTS mfa_secret;
