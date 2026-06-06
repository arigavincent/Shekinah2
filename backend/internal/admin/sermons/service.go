package sermons

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidInput = errors.New("invalid sermon input")

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) List(ctx context.Context) ([]Sermon, error) {
	return s.repository.List(ctx)
}

func (s Service) Create(ctx context.Context, req CreateRequest) (Sermon, error) {
	command, err := createCommandFromRequest(req)
	if err != nil {
		return Sermon{}, err
	}

	return s.repository.Create(ctx, command)
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest) (Sermon, error) {
	current, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return Sermon{}, err
	}

	sermonDate, err := parseDate(current.SermonDate)
	if err != nil {
		return Sermon{}, fmt.Errorf("parse current sermon date: %w", err)
	}

	command := Command{
		ID:           current.ID,
		Type:         current.Type,
		Title:        current.Title,
		Speaker:      current.Speaker,
		SermonDate:   sermonDate,
		CategoryID:   current.CategoryID,
		IsLive:       current.IsLive,
		ThumbnailURL: current.ThumbnailURL,
		Duration:     current.Duration,
		Description:  current.Description,
		MediaURL:     current.MediaURL,
	}

	if req.Type != nil {
		command.Type = normalize(*req.Type)
	}

	if req.Title != nil {
		command.Title = strings.TrimSpace(*req.Title)
	}

	if req.Speaker != nil {
		command.Speaker = strings.TrimSpace(*req.Speaker)
	}

	if req.SermonDate != nil {
		parsed, err := parseDate(*req.SermonDate)
		if err != nil {
			return Sermon{}, ErrInvalidInput
		}

		command.SermonDate = parsed
	}

	if req.CategoryID != nil {
		command.CategoryID = strings.TrimSpace(*req.CategoryID)
	}

	if req.IsLive != nil {
		command.IsLive = *req.IsLive
	}

	if req.ThumbnailURL != nil {
		command.ThumbnailURL = strings.TrimSpace(*req.ThumbnailURL)
	}

	if req.Duration != nil {
		command.Duration = strings.TrimSpace(*req.Duration)
	}

	if req.Description != nil {
		command.Description = strings.TrimSpace(*req.Description)
	}

	if req.MediaURL != nil {
		command.MediaURL = strings.TrimSpace(*req.MediaURL)
	}

	if err := validateCommand(command); err != nil {
		return Sermon{}, err
	}

	return s.repository.Update(ctx, command)
}

func (s Service) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidInput
	}

	return s.repository.Delete(ctx, id)
}

func createCommandFromRequest(req CreateRequest) (Command, error) {
	sermonDate, err := parseDate(req.SermonDate)
	if err != nil {
		return Command{}, ErrInvalidInput
	}

	id := strings.TrimSpace(req.ID)
	if id == "" {
		id = generateID("ser")
	}

	command := Command{
		ID:           id,
		Type:         normalize(req.Type),
		Title:        strings.TrimSpace(req.Title),
		Speaker:      strings.TrimSpace(req.Speaker),
		SermonDate:   sermonDate,
		CategoryID:   strings.TrimSpace(req.CategoryID),
		IsLive:       req.IsLive,
		ThumbnailURL: strings.TrimSpace(req.ThumbnailURL),
		Duration:     strings.TrimSpace(req.Duration),
		Description:  strings.TrimSpace(req.Description),
		MediaURL:     strings.TrimSpace(req.MediaURL),
	}

	if err := validateCommand(command); err != nil {
		return Command{}, err
	}

	return command, nil
}

func validateCommand(command Command) error {
	if command.ID == "" ||
		command.Title == "" ||
		command.Speaker == "" ||
		command.Description == "" {
		return ErrInvalidInput
	}

	if command.Type != "video" && command.Type != "audio" {
		return ErrInvalidInput
	}

	return nil
}

func parseDate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", strings.TrimSpace(value))
}

func normalize(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func generateID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}
