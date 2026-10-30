-- +goose Up
CREATE TABLE publication_notifications (
 kind TEXT NOT NULL, item_id TEXT NOT NULL, due_at TIMESTAMPTZ NOT NULL,
 processed_at TIMESTAMPTZ, lease_until TIMESTAMPTZ, PRIMARY KEY(kind,item_id)
);
-- Already published content is history. Future scheduled content remains queued.
INSERT INTO publication_notifications SELECT 'sermons',id,published_at,CASE WHEN published_at<=NOW() THEN NOW() END,NULL FROM sermons;
INSERT INTO publication_notifications SELECT 'devotion',id,published_at,CASE WHEN published_at<=NOW() THEN NOW() END,NULL FROM devotions;
INSERT INTO publication_notifications SELECT 'events',id,NOW(),NOW(),NULL FROM events;
INSERT INTO publication_notifications SELECT 'updates',id,NOW(),NOW(),NULL FROM updates;
-- +goose StatementBegin
CREATE FUNCTION queue_publication_notification() RETURNS TRIGGER AS $$
DECLARE notification_kind TEXT; due TIMESTAMPTZ;
BEGIN
 notification_kind:=CASE TG_TABLE_NAME WHEN 'devotions' THEN 'devotion' ELSE TG_TABLE_NAME END;
 IF TG_TABLE_NAME IN ('sermons','devotions') THEN due:=NEW.published_at; ELSE due:=NOW(); END IF;
 INSERT INTO publication_notifications(kind,item_id,due_at) VALUES(notification_kind,NEW.id,due)
 ON CONFLICT ON CONSTRAINT publication_notifications_pkey DO UPDATE SET due_at=EXCLUDED.due_at WHERE publication_notifications.processed_at IS NULL;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
CREATE TRIGGER notify_sermon AFTER INSERT OR UPDATE ON sermons FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
CREATE TRIGGER notify_devotion AFTER INSERT OR UPDATE ON devotions FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
CREATE TRIGGER notify_event AFTER INSERT ON events FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
CREATE TRIGGER notify_update AFTER INSERT ON updates FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
-- +goose Down
DROP TRIGGER notify_sermon ON sermons;
DROP TRIGGER notify_devotion ON devotions;
DROP TRIGGER notify_event ON events;
DROP TRIGGER notify_update ON updates;
DROP FUNCTION queue_publication_notification();
DROP TABLE publication_notifications;
