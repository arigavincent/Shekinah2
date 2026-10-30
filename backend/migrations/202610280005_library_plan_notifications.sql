-- +goose Up
INSERT INTO publication_notifications SELECT 'library',id,published_at,CASE WHEN published_at<=NOW() THEN NOW() END,NULL FROM library_items;
INSERT INTO publication_notifications SELECT 'plans',id,NOW(),NOW(),NULL FROM reading_plans;
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
CREATE TRIGGER notify_library AFTER INSERT OR UPDATE ON library_items FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
CREATE TRIGGER notify_plan AFTER INSERT OR UPDATE ON reading_plans FOR EACH ROW EXECUTE FUNCTION queue_publication_notification();
-- +goose Down
DROP TRIGGER notify_library ON library_items;
DROP TRIGGER notify_plan ON reading_plans;
DELETE FROM publication_notifications WHERE kind IN ('library','plans');
