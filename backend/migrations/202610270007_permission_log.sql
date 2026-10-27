-- +goose Up
-- Who granted or removed which permission, and when (record keeping).
CREATE TABLE IF NOT EXISTS permission_changes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('granted', 'removed')),
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_permission_changes_created ON permission_changes(created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS permission_changes;
