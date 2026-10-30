-- +goose Up
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
-- +goose Down
-- Quiet notification history is preserved.
