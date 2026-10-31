package notifications

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"time"
)

// Publication state is durable and scheduling survives API restarts. Existing
// content is seeded as processed by the migration, so startup never replays it.
func (h Handler) PublishWatch(ctx context.Context) {
	tick := time.NewTicker(30 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
		if err := h.PublishNext(ctx); err != nil {
			fmt.Printf("publication notification: %v\n", err)
		}
	}
}
func (h Handler) PublishNext(ctx context.Context) error {
	var kind, id string
	err := h.db.QueryRow(ctx, `UPDATE publication_notifications SET lease_until=NOW()+INTERVAL '5 minutes' WHERE (kind,item_id)=(SELECT kind,item_id FROM publication_notifications WHERE processed_at IS NULL AND due_at<=NOW() AND (lease_until IS NULL OR lease_until<NOW()) ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING kind,item_id`).Scan(&kind, &id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	var title string
	var ready bool
	switch kind {
	case "sermons":
		err = h.db.QueryRow(ctx, `SELECT title,status='ready' AND is_published AND notify_on_publish AND published_at<=NOW() FROM sermons WHERE id=$1`, id).Scan(&title, &ready)
	case "devotion":
		err = h.db.QueryRow(ctx, `SELECT title,published_at<=NOW() FROM devotions WHERE id=$1`, id).Scan(&title, &ready)
	case "events":
		err = h.db.QueryRow(ctx, `SELECT title,is_published AND notify_on_publish AND published_at<=NOW() FROM events WHERE id=$1`, id).Scan(&title, &ready)
	case "library":
		err = h.db.QueryRow(ctx, `SELECT title,is_published AND notify_on_publish AND published_at<=NOW() FROM library_items WHERE id=$1`, id).Scan(&title, &ready)
	case "plans":
		err = h.db.QueryRow(ctx, `SELECT title,is_active FROM reading_plans WHERE id=$1`, id).Scan(&title, &ready)
	case "updates":
		err = h.db.QueryRow(ctx, `SELECT title,TRUE FROM updates WHERE id=$1`, id).Scan(&title, &ready)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		_, err = h.db.Exec(ctx, `UPDATE publication_notifications SET processed_at=NOW() WHERE kind=$1 AND item_id=$2`, kind, id)
		return err
	}
	if err != nil {
		return err
	}
	if !ready {
		_, err = h.db.Exec(ctx, `UPDATE publication_notifications SET due_at=GREATEST(due_at,NOW()+INTERVAL '5 minutes'),lease_until=NULL WHERE kind=$1 AND item_id=$2`, kind, id)
		return err
	}
	category := kind
	if category == "plans" {
		category = "devotion"
	}
	if category == "updates" || category == "library" {
		category = "general"
	}
	_, err = h.Notify(ctx, BroadcastRequest{Title: title, Body: map[string]string{"sermons": "A new message is ready to watch or listen to.", "devotion": "Your devotional is ready to read.", "events": "See the details and register in the app.", "updates": "Read the latest ministry update.", "library": "A new book or study resource is ready in the library.", "plans": "Start a new reading plan in the app."}[kind], Category: category, Data: map[string]interface{}{"open": kind, "id": id}})
	if err != nil {
		return err
	}
	_, err = h.db.Exec(ctx, `UPDATE publication_notifications SET processed_at=NOW(),lease_until=NULL WHERE kind=$1 AND item_id=$2`, kind, id)
	return err
}
