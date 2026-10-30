-- +goose Up
ALTER TABLE sermons ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN notify_on_publish BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE events ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN notify_on_publish BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE library_items ADD COLUMN notify_on_publish BOOLEAN NOT NULL DEFAULT TRUE;
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION queue_publication_notification() RETURNS TRIGGER AS $$
DECLARE notification_kind TEXT; due TIMESTAMPTZ; quiet BOOLEAN:=FALSE;
BEGIN
 notification_kind:=CASE TG_TABLE_NAME WHEN 'devotions' THEN 'devotion' WHEN 'library_items' THEN 'library' WHEN 'reading_plans' THEN 'plans' ELSE TG_TABLE_NAME END;
 IF TG_TABLE_NAME IN ('sermons','devotions','events','library_items') THEN due:=NEW.published_at; ELSE due:=NOW(); END IF;
 IF TG_TABLE_NAME IN ('sermons','events','library_items') THEN quiet:=NOT NEW.notify_on_publish; END IF;
 INSERT INTO publication_notifications(kind,item_id,due_at,processed_at) VALUES(notification_kind,NEW.id,due,CASE WHEN quiet THEN NOW() END)
 ON CONFLICT ON CONSTRAINT publication_notifications_pkey DO UPDATE SET due_at=EXCLUDED.due_at,processed_at=EXCLUDED.processed_at WHERE publication_notifications.processed_at IS NULL;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
DROP TRIGGER notify_event ON events;
CREATE TRIGGER notify_event AFTER INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
-- +goose Down
DROP TRIGGER notify_event ON events;
CREATE TRIGGER notify_event AFTER INSERT ON events FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
ALTER TABLE library_items DROP COLUMN notify_on_publish;
ALTER TABLE events DROP COLUMN published_at, DROP COLUMN is_published, DROP COLUMN notify_on_publish;
ALTER TABLE sermons DROP COLUMN is_published, DROP COLUMN notify_on_publish;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION queue_publication_notification() RETURNS TRIGGER AS $$
DECLARE notification_kind TEXT; due TIMESTAMPTZ;
BEGIN
 notification_kind:=CASE TG_TABLE_NAME WHEN 'devotions' THEN 'devotion' WHEN 'library_items' THEN 'library' WHEN 'reading_plans' THEN 'plans' ELSE TG_TABLE_NAME END;
 IF TG_TABLE_NAME IN ('sermons','devotions','library_items') THEN due:=NEW.published_at; ELSE due:=NOW(); END IF;
 INSERT INTO publication_notifications(kind,item_id,due_at) VALUES(notification_kind,NEW.id,due)
 ON CONFLICT ON CONSTRAINT publication_notifications_pkey DO UPDATE SET due_at=EXCLUDED.due_at WHERE publication_notifications.processed_at IS NULL;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
