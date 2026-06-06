package devotions

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("devotion not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) List(ctx context.Context) ([]Devotion, error) {
	const query = `
		SELECT
			id,
			title,
			excerpt,
			devotion_date::text,
			image_url,
			body,
			created_at,
			updated_at
		FROM devotions
		ORDER BY devotion_date DESC, created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query admin devotions: %w", err)
	}
	defer rows.Close()

	items := make([]Devotion, 0)

	for rows.Next() {
		item, err := scanDevotion(rows)
		if err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate admin devotions: %w", err)
	}

	return items, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (Devotion, error) {
	const query = `
		SELECT
			id,
			title,
			excerpt,
			devotion_date::text,
			image_url,
			body,
			created_at,
			updated_at
		FROM devotions
		WHERE id = $1
		LIMIT 1
	`

	item, err := scanDevotion(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Devotion{}, ErrNotFound
		}

		return Devotion{}, fmt.Errorf("find devotion: %w", err)
	}

	return item, nil
}

func (r Repository) Create(ctx context.Context, command Command) (Devotion, error) {
	const query = `
		INSERT INTO devotions (
			id,
			title,
			excerpt,
			devotion_date,
			image_url,
			body
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING
			id,
			title,
			excerpt,
			devotion_date::text,
			image_url,
			body,
			created_at,
			updated_at
	`

	item, err := scanDevotion(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Title,
			command.Excerpt,
			command.DevotionDate,
			command.ImageURL,
			command.Body,
		),
	)
	if err != nil {
		return Devotion{}, fmt.Errorf("create devotion: %w", err)
	}

	return item, nil
}

func (r Repository) Update(ctx context.Context, command Command) (Devotion, error) {
	const query = `
		UPDATE devotions
		SET
			title = $2,
			excerpt = $3,
			devotion_date = $4,
			image_url = $5,
			body = $6,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			title,
			excerpt,
			devotion_date::text,
			image_url,
			body,
			created_at,
			updated_at
	`

	item, err := scanDevotion(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Title,
			command.Excerpt,
			command.DevotionDate,
			command.ImageURL,
			command.Body,
		),
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Devotion{}, ErrNotFound
		}

		return Devotion{}, fmt.Errorf("update devotion: %w", err)
	}

	return item, nil
}

func (r Repository) Delete(ctx context.Context, id string) error {
	const query = `
		DELETE FROM devotions
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete devotion: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

type devotionScanner interface {
	Scan(dest ...any) error
}

func scanDevotion(row devotionScanner) (Devotion, error) {
	var item Devotion

	if err := row.Scan(
		&item.ID,
		&item.Title,
		&item.Excerpt,
		&item.DevotionDate,
		&item.ImageURL,
		&item.Body,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Devotion{}, err
	}

	return item, nil
}
