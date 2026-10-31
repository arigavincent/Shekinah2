-- +goose Up
CREATE TABLE staff_actions (
 id BIGSERIAL PRIMARY KEY, actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
 method TEXT NOT NULL, route TEXT NOT NULL, item_id TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX staff_actions_created ON staff_actions(created_at DESC);
-- +goose Down
DROP TABLE staff_actions;
