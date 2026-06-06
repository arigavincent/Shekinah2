package liveconfig

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("live config not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) Get(ctx context.Context) (LiveConfig, error) {
	const query = `
		SELECT
			id,
			is_live,
			title,
			viewers,
			next_service,
			youtube_id,
			updated_at
		FROM live_stream_config
		ORDER BY updated_at DESC
		LIMIT 1
	`

	item, err := scanLiveConfig(r.db.QueryRow(ctx, query))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return LiveConfig{}, ErrNotFound
		}

		return LiveConfig{}, fmt.Errorf("get live config: %w", err)
	}

	return item, nil
}

func (r Repository) Upsert(ctx context.Context, command Command) (LiveConfig, error) {
	const query = `
		INSERT INTO live_stream_config (
			id,
			is_live,
			title,
			viewers,
			next_service,
			youtube_id,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, now())
		ON CONFLICT (id)
		DO UPDATE SET
			is_live = EXCLUDED.is_live,
			title = EXCLUDED.title,
			viewers = EXCLUDED.viewers,
			next_service = EXCLUDED.next_service,
			youtube_id = EXCLUDED.youtube_id,
			updated_at = now()
		RETURNING
			id,
			is_live,
			title,
			viewers,
			next_service,
			youtube_id,
			updated_at
	`

	item, err := scanLiveConfig(
		r.db.QueryRow(
			ctx,
			query,
			command.ID,
			command.IsLive,
			command.Title,
			command.Viewers,
			command.NextService,
			command.YoutubeID,
		),
	)
	if err != nil {
		return LiveConfig{}, fmt.Errorf("upsert live config: %w", err)
	}

	return item, nil
}

type liveConfigScanner interface {
	Scan(dest ...any) error
}

func scanLiveConfig(row liveConfigScanner) (LiveConfig, error) {
	var item LiveConfig

	if err := row.Scan(
		&item.ID,
		&item.IsLive,
		&item.Title,
		&item.Viewers,
		&item.NextService,
		&item.YoutubeID,
		&item.UpdatedAt,
	); err != nil {
		return LiveConfig{}, err
	}

	return item, nil
}
