package events

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("event not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) List(ctx context.Context) ([]Event, error) {
	const query = `
		SELECT
			id,
			title,
			event_date::text,
			event_time,
			location,
			image_url,
			description,
			created_at,
			updated_at
		FROM events
		ORDER BY event_date ASC, created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query admin events: %w", err)
	}
	defer rows.Close()

	items := make([]Event, 0)

	for rows.Next() {
		item, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate admin events: %w", err)
	}

	return items, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (Event, error) {
	const query = `
		SELECT
			id,
			title,
			event_date::text,
			event_time,
			location,
			image_url,
			description,
			created_at,
			updated_at
		FROM events
		WHERE id = $1
		LIMIT 1
	`

	item, err := scanEvent(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Event{}, ErrNotFound
		}

		return Event{}, fmt.Errorf("find event: %w", err)
	}

	return item, nil
}

func (r Repository) Create(ctx context.Context, command Command) (Event, error) {
	const query = `
		INSERT INTO events (
			id,
			title,
			event_date,
			event_time,
			location,
			image_url,
			description
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			id,
			title,
			event_date::text,
			event_time,
			location,
			image_url,
			description,
			created_at,
			updated_at
	`

	item, err := scanEvent(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Title,
			command.EventDate,
			command.EventTime,
			command.Location,
			command.ImageURL,
			command.Description,
		),
	)
	if err != nil {
		return Event{}, fmt.Errorf("create event: %w", err)
	}

	return item, nil
}

func (r Repository) Update(ctx context.Context, command Command) (Event, error) {
	const query = `
		UPDATE events
		SET
			title = $2,
			event_date = $3,
			event_time = $4,
			location = $5,
			image_url = $6,
			description = $7,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			title,
			event_date::text,
			event_time,
			location,
			image_url,
			description,
			created_at,
			updated_at
	`

	item, err := scanEvent(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.Title,
			command.EventDate,
			command.EventTime,
			command.Location,
			command.ImageURL,
			command.Description,
		),
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Event{}, ErrNotFound
		}

		return Event{}, fmt.Errorf("update event: %w", err)
	}

	return item, nil
}

func (r Repository) Delete(ctx context.Context, id string) error {
	const query = `
		DELETE FROM events
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete event: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

type eventScanner interface {
	Scan(dest ...any) error
}

func scanEvent(row eventScanner) (Event, error) {
	var item Event

	if err := row.Scan(
		&item.ID,
		&item.Title,
		&item.EventDate,
		&item.EventTime,
		&item.Location,
		&item.ImageURL,
		&item.Description,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Event{}, err
	}

	return item, nil
}
