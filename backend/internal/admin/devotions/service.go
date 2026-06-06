package devotions

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidInput = errors.New("invalid devotion input")

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) List(ctx context.Context) ([]Devotion, error) {
	return s.repository.List(ctx)
}

func (s Service) Create(ctx context.Context, req CreateRequest) (Devotion, error) {
	command, err := createCommandFromRequest(req)
	if err != nil {
		return Devotion{}, err
	}

	return s.repository.Create(ctx, command)
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest) (Devotion, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Devotion{}, ErrInvalidInput
	}

	current, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return Devotion{}, err
	}

	currentDate, err := parseDate(current.DevotionDate)
	if err != nil {
		return Devotion{}, ErrInvalidInput
	}

	command := Command{
		ID:           current.ID,
		Title:        current.Title,
		Excerpt:      current.Excerpt,
		DevotionDate: currentDate,
		ImageURL:     current.ImageURL,
		Body:         current.Body,
	}

	if req.Title != nil {
		command.Title = strings.TrimSpace(*req.Title)
	}

	if req.Excerpt != nil {
		command.Excerpt = strings.TrimSpace(*req.Excerpt)
	}

	if req.DevotionDate != nil {
		parsed, err := parseDate(*req.DevotionDate)
		if err != nil {
			return Devotion{}, ErrInvalidInput
		}

		command.DevotionDate = parsed
	}

	if req.ImageURL != nil {
		command.ImageURL = strings.TrimSpace(*req.ImageURL)
	}

	if req.Body != nil {
		command.Body = strings.TrimSpace(*req.Body)
	}

	if err := validateCommand(command); err != nil {
		return Devotion{}, err
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
	devotionDate, err := parseDate(req.DevotionDate)
	if err != nil {
		return Command{}, ErrInvalidInput
	}

	command := Command{
		ID:           generateID("dev"),
		Title:        strings.TrimSpace(req.Title),
		Excerpt:      strings.TrimSpace(req.Excerpt),
		DevotionDate: devotionDate,
		ImageURL:     strings.TrimSpace(req.ImageURL),
		Body:         strings.TrimSpace(req.Body),
	}

	if err := validateCommand(command); err != nil {
		return Command{}, err
	}

	return command, nil
}

func validateCommand(command Command) error {
	if command.ID == "" ||
		command.Title == "" ||
		command.Excerpt == "" ||
		command.Body == "" {
		return ErrInvalidInput
	}

	return nil
}

func parseDate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", strings.TrimSpace(value))
}

func generateID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}
