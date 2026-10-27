package categories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("category not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

const selectCategory = `
	SELECT c.id, c.name, c.image_url, COUNT(s.id)::int, c.created_at, c.updated_at
	FROM sermon_categories c
	LEFT JOIN sermons s ON s.category_id = c.id
`

func (r Repository) List(ctx context.Context) ([]Category, error) {
	rows, err := r.db.Query(ctx, selectCategory+` GROUP BY c.id ORDER BY c.name ASC`)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	items := make([]Category, 0)
	for rows.Next() {
		var item Category
		if err := rows.Scan(&item.ID, &item.Name, &item.ImageURL, &item.SermonCount, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate categories: %w", err)
	}
	return items, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (Category, error) {
	var item Category
	err := r.db.QueryRow(ctx, selectCategory+` WHERE c.id = $1 GROUP BY c.id`, id).
		Scan(&item.ID, &item.Name, &item.ImageURL, &item.SermonCount, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, ErrNotFound
		}
		return Category{}, fmt.Errorf("find category: %w", err)
	}
	return item, nil
}

func (r Repository) Create(ctx context.Context, id string, name string, imageURL string) (Category, error) {
	if _, err := r.db.Exec(ctx, `INSERT INTO sermon_categories (id, name, image_url) VALUES ($1, $2, $3)`, id, name, imageURL); err != nil {
		return Category{}, fmt.Errorf("create category: %w", err)
	}
	return r.FindByID(ctx, id)
}

func (r Repository) Update(ctx context.Context, id string, name string, imageURL string) (Category, error) {
	result, err := r.db.Exec(ctx, `UPDATE sermon_categories SET name = $2, image_url = $3, updated_at = now() WHERE id = $1`, id, name, imageURL)
	if err != nil {
		return Category{}, fmt.Errorf("update category: %w", err)
	}
	if result.RowsAffected() == 0 {
		return Category{}, ErrNotFound
	}
	return r.FindByID(ctx, id)
}

// Delete removes the category; its sermons stay and become uncategorised
// (the foreign key is ON DELETE SET NULL).
func (r Repository) Delete(ctx context.Context, id string) error {
	result, err := r.db.Exec(ctx, `DELETE FROM sermon_categories WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete category: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
