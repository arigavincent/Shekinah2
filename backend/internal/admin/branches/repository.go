package branches

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("branch not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) List(ctx context.Context) ([]Branch, error) {
	const query = `
		SELECT
			id,
			name,
			address,
			services,
			phone,
			latitude,
			longitude,
			image_url,
			created_at,
			updated_at
		FROM branches
		ORDER BY name ASC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query admin branches: %w", err)
	}
	defer rows.Close()

	items := make([]Branch, 0)

	for rows.Next() {
		item, err := scanBranch(rows)
		if err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate admin branches: %w", err)
	}

	return items, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (Branch, error) {
	const query = `
		SELECT
			id,
			name,
			address,
			services,
			phone,
			latitude,
			longitude,
			image_url,
			created_at,
			updated_at
		FROM branches
		WHERE id = $1
		LIMIT 1
	`

	item, err := scanBranch(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Branch{}, ErrNotFound
		}

		return Branch{}, fmt.Errorf("find branch: %w", err)
	}

	return item, nil
}

func (r Repository) Create(ctx context.Context, command Command) (Branch, error) {
	const query = `
		INSERT INTO branches (
			id,
			name,
			address,
			services,
			phone,
			latitude,
			longitude,
			image_url
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING
			id,
			name,
			address,
			services,
			phone,
			latitude,
			longitude,
			image_url,
			created_at,
			updated_at
	`

	item, err := scanBranch(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Name,
			command.Address,
			command.Services,
			command.Phone,
			command.Latitude,
			command.Longitude,
			command.ImageURL,
		),
	)
	if err != nil {
		return Branch{}, fmt.Errorf("create branch: %w", err)
	}

	return item, nil
}

func (r Repository) Update(ctx context.Context, command Command) (Branch, error) {
	const query = `
		UPDATE branches
		SET
			name = $2,
			address = $3,
			services = $4,
			phone = $5,
			latitude = $6,
			longitude = $7,
			image_url = $8,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			name,
			address,
			services,
			phone,
			latitude,
			longitude,
			image_url,
			created_at,
			updated_at
	`

	item, err := scanBranch(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Name,
			command.Address,
			command.Services,
			command.Phone,
			command.Latitude,
			command.Longitude,
			command.ImageURL,
		),
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Branch{}, ErrNotFound
		}

		return Branch{}, fmt.Errorf("update branch: %w", err)
	}

	return item, nil
}

func (r Repository) Delete(ctx context.Context, id string) error {
	const query = `
		DELETE FROM branches
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete branch: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

type branchScanner interface {
	Scan(dest ...any) error
}

func scanBranch(row branchScanner) (Branch, error) {
	var item Branch

	if err := row.Scan(
		&item.ID,
		&item.Name,
		&item.Address,
		&item.Services,
		&item.Phone,
		&item.Latitude,
		&item.Longitude,
		&item.ImageURL,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Branch{}, err
	}

	return item, nil
}
