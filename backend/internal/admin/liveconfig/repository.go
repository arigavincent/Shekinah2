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
			COALESCE(provider, 'youtube'),
			COALESCE(cloudflare_live_input_id, ''),
			COALESCE(cloudflare_playback_uid, ''),
			COALESCE(playback_hls_url, ''),
			COALESCE(playback_dash_url, ''),
			COALESCE(embed_url, ''),
			COALESCE(webrtc_publish_url, ''),
			COALESCE(webrtc_playback_url, ''),
			COALESCE(rtmps_url, ''),
			COALESCE(srt_url, ''),
			COALESCE(srt_stream_id, ''),
			COALESCE(stream_key, ''),
			COALESCE(srt_passphrase, ''),
			COALESCE(replay_url, ''),
			updated_at
		FROM live_stream_config
		WHERE id = 'main'
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
			provider,
			cloudflare_live_input_id,
			cloudflare_playback_uid,
			playback_hls_url,
			playback_dash_url,
			embed_url,
			webrtc_publish_url,
			webrtc_playback_url,
			rtmps_url,
			srt_url,
			srt_stream_id,
			stream_key,
			srt_passphrase,
			replay_url,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, now())
		ON CONFLICT (id)
		DO UPDATE SET
			is_live = EXCLUDED.is_live,
			title = EXCLUDED.title,
			viewers = EXCLUDED.viewers,
			next_service = EXCLUDED.next_service,
			youtube_id = EXCLUDED.youtube_id,
			provider = EXCLUDED.provider,
			cloudflare_live_input_id = EXCLUDED.cloudflare_live_input_id,
			cloudflare_playback_uid = EXCLUDED.cloudflare_playback_uid,
			playback_hls_url = EXCLUDED.playback_hls_url,
			playback_dash_url = EXCLUDED.playback_dash_url,
			embed_url = EXCLUDED.embed_url,
			webrtc_publish_url = EXCLUDED.webrtc_publish_url,
			webrtc_playback_url = EXCLUDED.webrtc_playback_url,
			rtmps_url = EXCLUDED.rtmps_url,
			srt_url = EXCLUDED.srt_url,
			srt_stream_id = EXCLUDED.srt_stream_id,
			stream_key = EXCLUDED.stream_key,
			srt_passphrase = EXCLUDED.srt_passphrase,
			replay_url = EXCLUDED.replay_url,
			updated_at = now()
		RETURNING
			id,
			is_live,
			title,
			viewers,
			next_service,
			youtube_id,
			COALESCE(provider, 'youtube'),
			COALESCE(cloudflare_live_input_id, ''),
			COALESCE(cloudflare_playback_uid, ''),
			COALESCE(playback_hls_url, ''),
			COALESCE(playback_dash_url, ''),
			COALESCE(embed_url, ''),
			COALESCE(webrtc_publish_url, ''),
			COALESCE(webrtc_playback_url, ''),
			COALESCE(rtmps_url, ''),
			COALESCE(srt_url, ''),
			COALESCE(srt_stream_id, ''),
			COALESCE(stream_key, ''),
			COALESCE(srt_passphrase, ''),
			COALESCE(replay_url, ''),
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
			command.Provider,
			command.CloudflareLiveInputID,
			command.CloudflarePlaybackUID,
			command.PlaybackHLSURL,
			command.PlaybackDASHURL,
			command.EmbedURL,
			command.WebRTCPublishURL,
			command.WebRTCPlaybackURL,
			command.RTMPSURL,
			command.SRTURL,
			command.SRTStreamID,
			command.StreamKey,
			command.SRTPassphrase,
			command.ReplayURL,
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
		&item.Provider,
		&item.CloudflareLiveInputID,
		&item.CloudflarePlaybackUID,
		&item.PlaybackHLSURL,
		&item.PlaybackDASHURL,
		&item.EmbedURL,
		&item.WebRTCPublishURL,
		&item.WebRTCPlaybackURL,
		&item.RTMPSURL,
		&item.SRTURL,
		&item.SRTStreamID,
		&item.StreamKey,
		&item.SRTPassphrase,
		&item.ReplayURL,
		&item.UpdatedAt,
	); err != nil {
		return LiveConfig{}, err
	}

	item.HasCloudflareLiveInput = item.CloudflareLiveInputID != ""
	return item, nil
}
