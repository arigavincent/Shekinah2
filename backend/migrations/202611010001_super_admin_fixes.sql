-- +goose Up

-- Fields the Super Admin screens record but the first schema lacked.
ALTER TABLE giving_kiosks ADD COLUMN IF NOT EXISTS serial_number TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE comm_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

ALTER TABLE ministry_groups DROP CONSTRAINT IF EXISTS ministry_groups_type_check;
ALTER TABLE ministry_groups ADD CONSTRAINT ministry_groups_type_check
    CHECK (type IN ('ministry', 'department', 'small_group', 'committee', 'sunday_school', 'fellowship'));

-- Keys created before created_by existed cannot be traced to a person; retire them.
UPDATE api_keys SET revoked_at = NOW() WHERE created_by IS NULL AND revoked_at IS NULL;

-- Webhook outbox: triggers record events however the change happened (app,
-- payment callbacks, staff tools); the API delivers and clears them.
CREATE TABLE IF NOT EXISTS webhook_outbox (
    id BIGSERIAL PRIMARY KEY,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION webhook_giving_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('success', 'refunded') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO webhook_outbox(event, payload) VALUES (
            CASE NEW.status WHEN 'success' THEN 'giving.received' ELSE 'giving.refunded' END,
            jsonb_build_object('id', NEW.id, 'amount', NEW.amount, 'currency', COALESCE(NEW.currency, 'KES'), 'category', NEW.category,
                'method', NEW.method, 'memberId', NEW.user_id, 'itemId', NEW.item_id, 'reference', COALESCE(NULLIF(NEW.mpesa_receipt_number, ''), NEW.provider_reference)));
    END IF;
    RETURN NEW;
END $$;
-- +goose StatementEnd
DROP TRIGGER IF EXISTS webhook_giving ON giving_transactions;
CREATE TRIGGER webhook_giving AFTER INSERT OR UPDATE OF status ON giving_transactions FOR EACH ROW EXECUTE FUNCTION webhook_giving_event();

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION webhook_member_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO webhook_outbox(event, payload) VALUES ('member.created', jsonb_build_object('id', NEW.id, 'name', NEW.name, 'email', NEW.email, 'role', NEW.role));
    RETURN NEW;
END $$;
-- +goose StatementEnd
DROP TRIGGER IF EXISTS webhook_member ON users;
CREATE TRIGGER webhook_member AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION webhook_member_event();

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION webhook_registration_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO webhook_outbox(event, payload) VALUES ('event.registered', jsonb_build_object('id', NEW.id, 'eventId', NEW.event_id, 'memberId', NEW.user_id));
    RETURN NEW;
END $$;
-- +goose StatementEnd
DROP TRIGGER IF EXISTS webhook_registration ON event_registrations;
CREATE TRIGGER webhook_registration AFTER INSERT ON event_registrations FOR EACH ROW EXECUTE FUNCTION webhook_registration_event();

-- On Supabase every table in public is reachable through its REST API unless
-- row level security is on. The backend connects as the owner, so it is unaffected.
-- +goose StatementBegin
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
DROP TRIGGER IF EXISTS webhook_registration ON event_registrations;
DROP TRIGGER IF EXISTS webhook_member ON users;
DROP TRIGGER IF EXISTS webhook_giving ON giving_transactions;
DROP FUNCTION IF EXISTS webhook_registration_event, webhook_member_event, webhook_giving_event;
DROP TABLE IF EXISTS webhook_outbox;
ALTER TABLE ministry_groups DROP CONSTRAINT IF EXISTS ministry_groups_type_check;
ALTER TABLE ministry_groups ADD CONSTRAINT ministry_groups_type_check
    CHECK (type IN ('department', 'small_group', 'committee', 'sunday_school', 'fellowship'));
DROP INDEX IF EXISTS idx_api_keys_hash;
ALTER TABLE api_keys DROP COLUMN IF EXISTS revoked_at, DROP COLUMN IF EXISTS created_by;
ALTER TABLE comm_templates DROP COLUMN IF EXISTS is_active;
ALTER TABLE attendance_sessions DROP COLUMN IF EXISTS notes;
ALTER TABLE giving_kiosks DROP COLUMN IF EXISTS serial_number;
