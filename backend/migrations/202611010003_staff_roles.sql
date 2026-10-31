-- +goose Up
-- Named roles a super admin designs (e.g. "Media team"); a person's
-- effective permissions are their role's plus any granted individually.
CREATE TABLE IF NOT EXISTS staff_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    permissions TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_role_id TEXT REFERENCES staff_roles(id) ON DELETE SET NULL;
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
-- +goose StatementBegin
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON staff_roles FROM anon, authenticated';
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS staff_role_id;
DROP TABLE IF EXISTS staff_roles;
