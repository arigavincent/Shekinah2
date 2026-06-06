package updates

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("update not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) List(ctx context.Context) ([]Update, error) {
	const query = `
		SELECT
			id,
			title,
			excerpt,
			update_date::text,
			image_url,
			created_at,
			updated_at
		FROM updates
		ORDER BY update_date DESC, created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query admin updates: %w", err)
	}
	defer rows.Close()

	items := make([]Update, 0)

	for rows.Next() {
		item, err := scanUpdate(rows)
		if err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate admin updates: %w", err)
	}

	return items, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (Update, error) {
	const query = `
		SELECT
			id,
			title,
			excerpt,
			update_date::text,
			image_url,
			created_at,
			updated_at
		FROM updates
		WHERE id = $1
		LIMIT 1
	`

	item, err := scanUpdate(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Update{}, ErrNotFound
		}

		return Update{}, fmt.Errorf("find update: %w", err)
	}

	return item, nil
}

func (r Repository) Create(ctx context.Context, command Command) (Update, error) {
	const query = `
		INSERT INTO updates (
			id,
			title,
			excerpt,
			update_date,
			image_url
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING
			id,
			title,
			excerpt,
			update_date::text,
			image_url,
			created_at,
			updated_at
	`

	item, err := scanUpdate(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Title,
			command.Excerpt,
			command.UpdateDate,
			command.ImageURL,
		),
	)
	if err != nil {
		return Update{}, fmt.Errorf("create update: %w", err)
	}

	return item, nil
}

func (r Repository) Update(ctx context.Context, command Command) (Update, error) {
	const query = `
		UPDATE updates
		SET
			title = $2,
			excerpt = $3,
			update_date = $4,
			image_url = $5,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			title,
			excerpt,
			update_date::text,
			image_url,
			created_at,
			updated_at
	`

	item, err := scanUpdate(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Title,
			command.Excerpt,
			command.UpdateDate,
			command.ImageURL,
		),
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Update{}, ErrNotFound
		}

		return Update{}, fmt.Errorf("update update: %w", err)
	}

	return item, nil
}

func (r Repository) Delete(ctx context.Context, id string) error {
	const query = `
		DELETE FROM updates
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete update: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

type updateScanner interface {
	Scan(dest ...any) error
}

func scanUpdate(row updateScanner) (Update, error) {
	var item Update

	if err := row.Scan(
		&item.ID,
		&item.Title,
		&item.Excerpt,
		&item.UpdateDate,
		&item.ImageURL,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Update{}, err
	}

	return item, nil
}
