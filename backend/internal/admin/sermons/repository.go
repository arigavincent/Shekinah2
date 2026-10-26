package sermons

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("sermon not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) List(ctx context.Context) ([]Sermon, error) {
	const query = `
		SELECT
			s.id,
			s.external_id,
			s.type,
			s.code,
			s.title,
			s.speaker,
			s.sermon_date::text,
			to_char(s.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			COALESCE(s.category_id, ''),
			COALESCE(c.name, ''),
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url,
			s.source,
			s.stream_uid,
			s.status,
			s.created_at,
			s.updated_at
		FROM sermons s
		LEFT JOIN sermon_categories c ON c.id = s.category_id
		ORDER BY s.sermon_date DESC, s.created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query admin sermons: %w", err)
	}
	defer rows.Close()

	items := make([]Sermon, 0)

	for rows.Next() {
		item, err := scanSermon(rows)
		if err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate admin sermons: %w", err)
	}

	return items, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (Sermon, error) {
	const query = `
		SELECT
			s.id,
			s.external_id,
			s.type,
			s.code,
			s.title,
			s.speaker,
			s.sermon_date::text,
			to_char(s.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			COALESCE(s.category_id, ''),
			COALESCE(c.name, ''),
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url,
			s.source,
			s.stream_uid,
			s.status,
			s.created_at,
			s.updated_at
		FROM sermons s
		LEFT JOIN sermon_categories c ON c.id = s.category_id
		WHERE s.id = $1
		LIMIT 1
	`

	row := r.db.QueryRow(ctx, query, id)

	item, err := scanSermon(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Sermon{}, ErrNotFound
		}

		return Sermon{}, fmt.Errorf("find sermon: %w", err)
	}

	return item, nil
}

func (r Repository) Create(ctx context.Context, command Command) (Sermon, error) {
	const query = `
		INSERT INTO sermons (
			id,
			external_id,
			type,
			title,
			speaker,
			sermon_date,
			published_at,
			category_id,
			is_live,
			thumbnail_url,
			duration,
			description,
			media_url,
			code,
			source,
			stream_uid,
			status
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING
			id,
			external_id,
			type,
			code,
			title,
			speaker,
			sermon_date::text,
			to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			COALESCE(category_id, ''),
			'',
			is_live,
			thumbnail_url,
			duration,
			description,
			media_url,
			source,
			stream_uid,
			status,
			created_at,
			updated_at
	`

	row := r.db.QueryRow(
		ctx,
		query,
		command.ID,
		command.ExternalID,
		command.Type,
		command.Title,
		command.Speaker,
		command.SermonDate,
		command.PublishedAt,
		command.CategoryID,
		command.IsLive,
		command.ThumbnailURL,
		command.Duration,
		command.Description,
		command.MediaURL,
		command.Code,
		command.Source,
		command.StreamUID,
		command.Status,
	)

	item, err := scanSermon(row)
	if err != nil {
		return Sermon{}, fmt.Errorf("create sermon: %w", err)
	}

	return r.FindByID(ctx, item.ID)
}

func (r Repository) Update(ctx context.Context, command Command) (Sermon, error) {
	const query = `
		UPDATE sermons
		SET
			external_id = $2,
			type = $3,
			title = $4,
			speaker = $5,
			sermon_date = $6,
			published_at = $7,
			category_id = NULLIF($8, ''),
			is_live = $9,
			thumbnail_url = $10,
			duration = $11,
			description = $12,
			media_url = $13,
			code = $14,
			source = $15,
			stream_uid = $16,
			status = $17,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			external_id,
			type,
			code,
			title,
			speaker,
			sermon_date::text,
			to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			COALESCE(category_id, ''),
			'',
			is_live,
			thumbnail_url,
			duration,
			description,
			media_url,
			source,
			stream_uid,
			status,
			created_at,
			updated_at
	`

	row := r.db.QueryRow(
		ctx,
		query,
		command.ID,
		command.ExternalID,
		command.Type,
		command.Title,
		command.Speaker,
		command.SermonDate,
		command.PublishedAt,
		command.CategoryID,
		command.IsLive,
		command.ThumbnailURL,
		command.Duration,
		command.Description,
		command.MediaURL,
		command.Code,
		command.Source,
		command.StreamUID,
		command.Status,
	)

	item, err := scanSermon(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Sermon{}, ErrNotFound
		}

		return Sermon{}, fmt.Errorf("update sermon: %w", err)
	}

	return r.FindByID(ctx, item.ID)
}

func (r Repository) FindByExternalID(ctx context.Context, externalID string) (Sermon, error) {
	const query = `
		SELECT
			s.id,
			s.external_id,
			s.type,
			s.code,
			s.title,
			s.speaker,
			s.sermon_date::text,
			to_char(s.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			COALESCE(s.category_id, ''),
			COALESCE(c.name, ''),
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url,
			s.source,
			s.stream_uid,
			s.status,
			s.created_at,
			s.updated_at
		FROM sermons s
		LEFT JOIN sermon_categories c ON c.id = s.category_id
		WHERE s.external_id = $1
		LIMIT 1
	`

	row := r.db.QueryRow(ctx, query, externalID)
	item, err := scanSermon(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Sermon{}, ErrNotFound
		}
		return Sermon{}, fmt.Errorf("find sermon by external id: %w", err)
	}
	return item, nil
}

func (r Repository) FindByStreamUID(ctx context.Context, streamUID string) (Sermon, error) {
	const query = `
		SELECT
			s.id,
			s.external_id,
			s.type,
			s.code,
			s.title,
			s.speaker,
			s.sermon_date::text,
			to_char(s.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			COALESCE(s.category_id, ''),
			COALESCE(c.name, ''),
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url,
			s.source,
			s.stream_uid,
			s.status,
			s.created_at,
			s.updated_at
		FROM sermons s
		LEFT JOIN sermon_categories c ON c.id = s.category_id
		WHERE s.stream_uid = $1
		LIMIT 1
	`

	item, err := scanSermon(r.db.QueryRow(ctx, query, streamUID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Sermon{}, ErrNotFound
		}
		return Sermon{}, fmt.Errorf("find sermon by stream uid: %w", err)
	}
	return item, nil
}

// ListByStatus returns sermons in one processing state, oldest first.
func (r Repository) ListByStatus(ctx context.Context, status string) ([]Sermon, error) {
	const query = `
		SELECT
			s.id,
			s.external_id,
			s.type,
			s.code,
			s.title,
			s.speaker,
			s.sermon_date::text,
			to_char(s.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			COALESCE(s.category_id, ''),
			COALESCE(c.name, ''),
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url,
			s.source,
			s.stream_uid,
			s.status,
			s.created_at,
			s.updated_at
		FROM sermons s
		LEFT JOIN sermon_categories c ON c.id = s.category_id
		WHERE s.status = $1
		ORDER BY s.created_at ASC
	`

	rows, err := r.db.Query(ctx, query, status)
	if err != nil {
		return nil, fmt.Errorf("query sermons by status: %w", err)
	}
	defer rows.Close()

	items := make([]Sermon, 0)
	for rows.Next() {
		item, err := scanSermon(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sermons by status: %w", err)
	}

	return items, nil
}

func (r Repository) Delete(ctx context.Context, id string) error {
	const query = `
		DELETE FROM sermons
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete sermon: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

type sermonScanner interface {
	Scan(dest ...any) error
}

func scanSermon(row sermonScanner) (Sermon, error) {
	var item Sermon

	if err := row.Scan(
		&item.ID,
		&item.ExternalID,
		&item.Type,
		&item.Code,
		&item.Title,
		&item.Speaker,
		&item.SermonDate,
		&item.PublishedAt,
		&item.CategoryID,
		&item.Category,
		&item.IsLive,
		&item.ThumbnailURL,
		&item.Duration,
		&item.Description,
		&item.MediaURL,
		&item.Source,
		&item.StreamUID,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Sermon{}, fmt.Errorf("scan sermon: %w", err)
	}

	return item, nil
}
