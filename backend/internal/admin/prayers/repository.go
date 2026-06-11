package prayers

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("prayer not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) List(ctx context.Context) ([]Prayer, error) {
	const query = `
		SELECT
			id,
			name,
			text,
			count,
			category,
			is_public,
			owner_email,
			status,
			admin_note,
			created_at,
			updated_at,
			reviewed_at
		FROM prayers
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query admin prayers: %w", err)
	}
	defer rows.Close()

	items := make([]Prayer, 0)
	for rows.Next() {
		item, err := scanPrayer(rows)
		if err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate admin prayers: %w", err)
	}

	return items, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (Prayer, error) {
	const query = `
		SELECT
			id,
			name,
			text,
			count,
			category,
			is_public,
			owner_email,
			status,
			admin_note,
			created_at,
			updated_at,
			reviewed_at
		FROM prayers
		WHERE id = $1
		LIMIT 1
	`

	item, err := scanPrayer(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Prayer{}, ErrNotFound
		}

		return Prayer{}, fmt.Errorf("find prayer: %w", err)
	}

	return item, nil
}

func (r Repository) Update(ctx context.Context, command Command) (Prayer, error) {
	const query = `
		UPDATE prayers
		SET
			status = $2,
			admin_note = $3,
			reviewed_by = $4,
			reviewed_at = $5,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			name,
			text,
			count,
			category,
			is_public,
			owner_email,
			status,
			admin_note,
			created_at,
			updated_at,
			reviewed_at
	`

	item, err := scanPrayer(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Status,
			command.AdminNote,
			command.ReviewedBy,
			command.ReviewedAt,
		),
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Prayer{}, ErrNotFound
		}

		return Prayer{}, fmt.Errorf("update prayer: %w", err)
	}

	return item, nil
}

type prayerScanner interface {
	Scan(dest ...any) error
}

func scanPrayer(row prayerScanner) (Prayer, error) {
	var item Prayer

	if err := row.Scan(
		&item.ID,
		&item.Name,
		&item.Text,
		&item.Count,
		&item.Category,
		&item.IsPublic,
		&item.OwnerEmail,
		&item.Status,
		&item.AdminNote,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.ReviewedAt,
	); err != nil {
		return Prayer{}, err
	}

	return item, nil
}
