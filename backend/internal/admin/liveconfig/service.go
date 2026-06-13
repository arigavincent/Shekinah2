package liveconfig

import (
	"context"
	"errors"
	"strings"
)

var ErrInvalidInput = errors.New("invalid live config input")

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
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
		ID:          "default",
		IsLive:      false,
		Title:       "Live Stream",
		Viewers:     "0",
		NextService: "Schedule will be updated soon.",
		YoutubeID:   "",
	}

	return s.repository.Upsert(ctx, command)
}

func (s Service) Update(ctx context.Context, req UpdateRequest) (LiveConfig, error) {
	current, err := s.Get(ctx)
	if err != nil {
		return LiveConfig{}, err
	}

	command := Command{
		ID:          current.ID,
		IsLive:      current.IsLive,
		Title:       current.Title,
		Viewers:     current.Viewers,
		NextService: current.NextService,
		YoutubeID:   current.YoutubeID,
	}

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

	if err := validateCommand(command); err != nil {
		return LiveConfig{}, err
	}

	return s.repository.Upsert(ctx, command)
}

func validateCommand(command Command) error {
	if command.ID == "" || command.NextService == "" {
		return ErrInvalidInput
	}

	if command.Viewers == "" {
		command.Viewers = "0"
	}

	if command.IsLive && (command.Title == "" || command.YoutubeID == "") {
		return ErrInvalidInput
	}

	return nil
}
