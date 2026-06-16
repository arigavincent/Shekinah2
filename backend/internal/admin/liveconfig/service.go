package liveconfig

import (
	"context"
	"errors"
	"strings"

	"github.com/ariga/shekinah-backend/internal/config"
)

var ErrInvalidInput = errors.New("invalid live config input")

type Service struct {
	repository Repository
	cloudflare CloudflareStreamClient
}

func NewService(repository Repository, cfg config.Config) Service {
	return Service{
		repository: repository,
		cloudflare: NewCloudflareStreamClient(cfg),
	}
}

func (s Service) Get(ctx context.Context) (LiveConfig, error) {
	item, err := s.repository.Get(ctx)
	if err == nil {
		return item, nil
	}

	if !errors.Is(err, ErrNotFound) {
		return LiveConfig{}, err
	}

	command := Command{
		ID:          "main",
		IsLive:      false,
		Title:       "Live Stream",
		Viewers:     "0",
		NextService: "Schedule will be updated soon.",
		YoutubeID:   "",
		Provider:    "youtube",
	}

	return s.repository.Upsert(ctx, command)
}

func (s Service) Update(ctx context.Context, req UpdateRequest) (LiveConfig, error) {
	current, err := s.Get(ctx)
	if err != nil {
		return LiveConfig{}, err
	}

	command := commandFromConfig(current)

	if req.IsLive != nil {
		command.IsLive = *req.IsLive
	}

	if req.Title != nil {
		command.Title = strings.TrimSpace(*req.Title)
	}

	if req.Viewers != nil {
		command.Viewers = strings.TrimSpace(*req.Viewers)
	}

	if req.NextService != nil {
		command.NextService = strings.TrimSpace(*req.NextService)
	}

	if req.YoutubeID != nil {
		command.YoutubeID = strings.TrimSpace(*req.YoutubeID)
	}

	if req.Provider != nil {
		command.Provider = cleanProvider(*req.Provider)
	}

	if req.ReplayURL != nil {
		command.ReplayURL = strings.TrimSpace(*req.ReplayURL)
	}

	if err := validateCommand(command); err != nil {
		return LiveConfig{}, err
	}

	return s.repository.Upsert(ctx, command)
}

func (s Service) CreateCloudflareLiveInput(ctx context.Context) (LiveConfig, error) {
	current, err := s.Get(ctx)
	if err != nil {
		return LiveConfig{}, err
	}

	input, err := s.cloudflare.CreateLiveInput(ctx, current.Title)
	if err != nil {
		return LiveConfig{}, err
	}

	playbackUID := input.UID
	command := commandFromConfig(current)
	command.Provider = "cloudflare_stream"
	command.CloudflareLiveInputID = input.UID
	command.CloudflarePlaybackUID = playbackUID
	command.PlaybackHLSURL = "https://videodelivery.net/" + playbackUID + "/manifest/video.m3u8"
	command.PlaybackDASHURL = "https://videodelivery.net/" + playbackUID + "/manifest/video.mpd"
	command.EmbedURL = "https://iframe.videodelivery.net/" + playbackUID
	command.RTMPSURL = input.RTMPSURL
	command.SRTURL = input.SRTURL
	command.SRTStreamID = input.SRTStreamID
	command.StreamKey = input.StreamKey
	command.SRTPassphrase = input.SRTPassphrase

	if err := validateCommand(command); err != nil {
		return LiveConfig{}, err
	}

	return s.repository.Upsert(ctx, command)
}

func commandFromConfig(current LiveConfig) Command {
	return Command{
		ID:                    current.ID,
		IsLive:                current.IsLive,
		Title:                 current.Title,
		Viewers:               current.Viewers,
		NextService:           current.NextService,
		YoutubeID:             current.YoutubeID,
		Provider:              cleanProvider(current.Provider),
		CloudflareLiveInputID: current.CloudflareLiveInputID,
		CloudflarePlaybackUID: current.CloudflarePlaybackUID,
		PlaybackHLSURL:        current.PlaybackHLSURL,
		PlaybackDASHURL:       current.PlaybackDASHURL,
		EmbedURL:              current.EmbedURL,
		RTMPSURL:              current.RTMPSURL,
		SRTURL:                current.SRTURL,
		SRTStreamID:           current.SRTStreamID,
		StreamKey:             current.StreamKey,
		SRTPassphrase:         current.SRTPassphrase,
		ReplayURL:             current.ReplayURL,
	}
}

func cleanProvider(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "cloudflare_stream", "external_hls", "facebook", "youtube":
		return strings.TrimSpace(strings.ToLower(value))
	default:
		return "youtube"
	}
}

func validateCommand(command Command) error {
	if command.ID == "" || command.NextService == "" {
		return ErrInvalidInput
	}

	if command.Provider == "" {
		command.Provider = "youtube"
	}

	if command.Viewers == "" {
		command.Viewers = "0"
	}

	if command.IsLive && command.Title == "" {
		return ErrInvalidInput
	}

	if command.IsLive && command.Provider == "youtube" && command.YoutubeID == "" {
		return ErrInvalidInput
	}

	if command.IsLive && command.Provider == "cloudflare_stream" && command.PlaybackHLSURL == "" {
		return ErrInvalidInput
	}

	return nil
}
