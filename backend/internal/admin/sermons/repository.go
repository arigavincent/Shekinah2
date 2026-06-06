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
			s.type,
			s.title,
			s.speaker,
			s.sermon_date::text,
			COALESCE(s.category_id, ''),
			COALESCE(c.name, ''),
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url,
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
			s.type,
			s.title,
			s.speaker,
			s.sermon_date::text,
			COALESCE(s.category_id, ''),
			COALESCE(c.name, ''),
			s.is_live,
			s.thumbnail_url,
			s.duration,
			s.description,
			s.media_url,
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
			type,
			title,
			speaker,
			sermon_date,
			category_id,
			is_live,
			thumbnail_url,
			duration,
			description,
			media_url
		)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, $10, $11)
		RETURNING
			id,
			type,
			title,
			speaker,
			sermon_date::text,
			COALESCE(category_id, ''),
			'',
			is_live,
			thumbnail_url,
			duration,
			description,
			media_url,
			created_at,
			updated_at
	`

	row := r.db.QueryRow(
		ctx,
		query,
		command.ID,
		command.Type,
		command.Title,
		command.Speaker,
		command.SermonDate,
		command.CategoryID,
		command.IsLive,
		command.ThumbnailURL,
		command.Duration,
		command.Description,
		command.MediaURL,
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
			type = $2,
			title = $3,
			speaker = $4,
			sermon_date = $5,
			category_id = NULLIF($6, ''),
			is_live = $7,
			thumbnail_url = $8,
			duration = $9,
			description = $10,
			media_url = $11,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			type,
			title,
			speaker,
			sermon_date::text,
			COALESCE(category_id, ''),
			'',
			is_live,
			thumbnail_url,
			duration,
			description,
			media_url,
			created_at,
			updated_at
	`

	row := r.db.QueryRow(
		ctx,
		query,
		command.ID,
		command.Type,
		command.Title,
		command.Speaker,
		command.SermonDate,
		command.CategoryID,
		command.IsLive,
		command.ThumbnailURL,
		command.Duration,
		command.Description,
		command.MediaURL,
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
		&item.Type,
		&item.Title,
		&item.Speaker,
		&item.SermonDate,
		&item.CategoryID,
		&item.Category,
		&item.IsLive,
		&item.ThumbnailURL,
		&item.Duration,
		&item.Description,
		&item.MediaURL,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Sermon{}, fmt.Errorf("scan sermon: %w", err)
	}

	return item, nil
}
