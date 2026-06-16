package content

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) LatestScripture(ctx context.Context) (Scripture, error) {
	const query = `
		SELECT title, verse, reference
		FROM scriptures
		ORDER BY scripture_date DESC
		LIMIT 1
	`

	var item Scripture

	err := r.db.QueryRow(ctx, query).Scan(
		&item.Title,
		&item.Verse,
		&item.Reference,
	)
	if err != nil {
		return Scripture{}, fmt.Errorf("query latest scripture: %w", err)
	}

	return item, nil
}

func (r Repository) LiveStream(ctx context.Context) (LiveStream, error) {
	const query = `
		SELECT is_live, title, viewers, next_service, youtube_id
		FROM live_stream_config
		WHERE id = 'main'
	`

	var item LiveStream

	err := r.db.QueryRow(ctx, query).Scan(
		&item.IsLive,
		&item.Title,
		&item.Viewers,
		&item.NextService,
		&item.YoutubeID,
	)
	if err != nil {
		return LiveStream{}, fmt.Errorf("query live stream config: %w", err)
	}

	return item, nil
}

func (r Repository) Devotions(ctx context.Context) ([]Devotion, error) {
	const query = `
		SELECT
			id,
			title,
			excerpt,
			to_char(devotion_date, 'FMMonth FMDD, YYYY') AS devotion_date,
			image_url,
			body
		FROM devotions
		WHERE published_at <= NOW()
		ORDER BY devotion_date DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query devotions: %w", err)
	}
	defer rows.Close()

	items := make([]Devotion, 0)

	for rows.Next() {
		var item Devotion

		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.Excerpt,
			&item.Date,
			&item.Image,
			&item.Body,
		); err != nil {
			return nil, fmt.Errorf("scan devotion: %w", err)
		}

		item.ImageURL = item.Image

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate devotions: %w", err)
	}

	return items, nil
}

func (r Repository) Sermons(ctx context.Context) ([]Sermon, error) {
	const query = `
		SELECT
			s.id,
			s.type,
			s.title,
			s.speaker,
			to_char(s.sermon_date, 'FMMonth FMDD, YYYY') AS sermon_date,
			COALESCE(c.name, '') AS category,
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url
		FROM sermons s
		LEFT JOIN sermon_categories c ON c.id = s.category_id
		WHERE s.published_at <= NOW()
		ORDER BY s.sermon_date DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query sermons: %w", err)
	}
	defer rows.Close()

	items := make([]Sermon, 0)

	for rows.Next() {
		var item Sermon

		if err := rows.Scan(
			&item.ID,
			&item.Type,
			&item.Title,
			&item.Speaker,
			&item.Date,
			&item.Category,
			&item.Live,
			&item.Thumbnail,
			&item.Duration,
			&item.Description,
			&item.MediaURL,
		); err != nil {
			return nil, fmt.Errorf("scan sermon: %w", err)
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sermons: %w", err)
	}

	return items, nil
}

func (r Repository) Categories(ctx context.Context) ([]Category, error) {
	const query = `
		SELECT
			c.id,
			c.name,
			COUNT(s.id)::int AS count,
			c.image_url
		FROM sermon_categories c
		LEFT JOIN sermons s
		  ON s.category_id = c.id
		 AND s.published_at <= NOW()
		GROUP BY c.id, c.name, c.image_url
		ORDER BY c.name ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	items := make([]Category, 0)

	for rows.Next() {
		var item Category

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Count,
			&item.Image,
		); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate categories: %w", err)
	}

	return items, nil
}

func (r Repository) Events(ctx context.Context) ([]Event, error) {
	const query = `
		SELECT
			id,
			title,
			to_char(event_date, 'FMMonth FMDD, YYYY') AS event_date,
			event_time,
			location,
			image_url,
			description
		FROM events
		ORDER BY event_date ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query events: %w", err)
	}
	defer rows.Close()

	items := make([]Event, 0)

	for rows.Next() {
		var item Event

		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.Date,
			&item.Time,
			&item.Location,
			&item.Image,
			&item.Description,
		); err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}

		item.ImageURL = item.Image
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate events: %w", err)
	}

	return items, nil
}

func (r Repository) Branches(ctx context.Context) ([]Branch, error) {
	const query = `
		SELECT
			id,
			name,
			address,
			services,
			phone,
			latitude,
			longitude,
			image_url
		FROM branches
		ORDER BY name ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query branches: %w", err)
	}
	defer rows.Close()

	items := make([]Branch, 0)

	for rows.Next() {
		var item Branch

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Address,
			&item.Services,
			&item.Phone,
			&item.Lat,
			&item.Lng,
			&item.Image,
		); err != nil {
			return nil, fmt.Errorf("scan branch: %w", err)
		}

		item.ImageURL = item.Image
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate branches: %w", err)
	}

	return items, nil
}

func (r Repository) Updates(ctx context.Context) ([]Update, error) {
	const query = `
		SELECT
			id,
			title,
			excerpt,
			to_char(update_date, 'FMMonth FMDD, YYYY') AS update_date,
			image_url
		FROM updates
		ORDER BY update_date DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query updates: %w", err)
	}
	defer rows.Close()

	items := make([]Update, 0)

	for rows.Next() {
		var item Update

		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.Excerpt,
			&item.Date,
			&item.Image,
		); err != nil {
			return nil, fmt.Errorf("scan update: %w", err)
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate updates: %w", err)
	}

	return items, nil
}

func (r Repository) Platforms(ctx context.Context) (map[string][]Platform, error) {
	const query = `
		SELECT id, type, name, description, link
		FROM platforms
		ORDER BY type ASC, name ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query platforms: %w", err)
	}
	defer rows.Close()

	items := map[string][]Platform{
		"Web":   {},
		"TV":    {},
		"Radio": {},
	}

	for rows.Next() {
		var platformType string
		var item Platform

		if err := rows.Scan(
			&item.ID,
			&platformType,
			&item.Name,
			&item.Description,
			&item.Link,
		); err != nil {
			return nil, fmt.Errorf("scan platform: %w", err)
		}

		items[platformType] = append(items[platformType], item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate platforms: %w", err)
	}

	return items, nil
}

func (r Repository) Clips(ctx context.Context) ([]Clip, error) {
	const query = `
		SELECT id, title, image_url, media_url, duration
		FROM clips
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query clips: %w", err)
	}
	defer rows.Close()

	items := make([]Clip, 0)

	for rows.Next() {
		var item Clip

		if err := rows.Scan(&item.ID, &item.Title, &item.Image, &item.MediaURL, &item.Duration); err != nil {
			return nil, fmt.Errorf("scan clip: %w", err)
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate clips: %w", err)
	}

	return items, nil
}

func (r Repository) Downloads(ctx context.Context) ([]Download, error) {
	const query = `
		SELECT id, title, size, image_url
		FROM downloads
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query downloads: %w", err)
	}
	defer rows.Close()

	items := make([]Download, 0)

	for rows.Next() {
		var item Download

		if err := rows.Scan(&item.ID, &item.Title, &item.Size, &item.Image); err != nil {
			return nil, fmt.Errorf("scan download: %w", err)
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate downloads: %w", err)
	}

	return items, nil
}

func (r Repository) Prayers(ctx context.Context) ([]Prayer, error) {
	const query = `
		SELECT
			id,
			name,
			text,
			CASE
				WHEN created_at::date = CURRENT_DATE THEN 'Today'
				WHEN created_at::date = CURRENT_DATE - INTERVAL '1 day' THEN 'Yesterday'
				ELSE to_char(created_at, 'FMMonth FMDD, YYYY')
			END AS prayer_date,
			count,
			category,
			is_public
		FROM prayers
		WHERE is_public = TRUE
		  AND status IN ('reviewed', 'prayed_for', 'contacted')
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query prayers: %w", err)
	}
	defer rows.Close()

	items := make([]Prayer, 0)

	for rows.Next() {
		var item Prayer

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Text,
			&item.Date,
			&item.Count,
			&item.Category,
			&item.IsPublic,
		); err != nil {
			return nil, fmt.Errorf("scan prayer: %w", err)
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate prayers: %w", err)
	}

	return items, nil
}

func (r Repository) About(ctx context.Context) (About, error) {
	const query = `
		SELECT vision, description, contact_summary
		FROM about_content
		WHERE id = 'main'
	`

	var item About

	if err := r.db.QueryRow(ctx, query).Scan(
		&item.Vision,
		&item.Description,
		&item.ContactSummary,
	); err != nil {
		return About{}, fmt.Errorf("query about content: %w", err)
	}

	return item, nil
}
