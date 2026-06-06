package updates

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidInput = errors.New("invalid update input")

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) List(ctx context.Context) ([]Update, error) {
	return s.repository.List(ctx)
}

func (s Service) Create(ctx context.Context, req CreateRequest) (Update, error) {
	command, err := createCommandFromRequest(req)
	if err != nil {
		return Update{}, err
	}

	return s.repository.Create(ctx, command)
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest) (Update, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Update{}, ErrInvalidInput
	}

	current, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return Update{}, err
	}

	currentDate, err := parseDate(current.UpdateDate)
	if err != nil {
		return Update{}, ErrInvalidInput
	}

	command := Command{
		ID:         current.ID,
		Title:      current.Title,
		Excerpt:    current.Excerpt,
		UpdateDate: currentDate,
		ImageURL:   current.ImageURL,
	}

	if req.Title != nil {
		command.Title = strings.TrimSpace(*req.Title)
	}

	if req.Excerpt != nil {
		command.Excerpt = strings.TrimSpace(*req.Excerpt)
	}

	if req.UpdateDate != nil {
		parsed, err := parseDate(*req.UpdateDate)
		if err != nil {
			return Update{}, ErrInvalidInput
		}

		command.UpdateDate = parsed
	}

	if req.ImageURL != nil {
		command.ImageURL = strings.TrimSpace(*req.ImageURL)
	}

	if err := validateCommand(command); err != nil {
		return Update{}, err
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
	updateDate, err := parseDate(req.UpdateDate)
	if err != nil {
		return Command{}, ErrInvalidInput
	}

	command := Command{
		ID:         generateID("up"),
		Title:      strings.TrimSpace(req.Title),
		Excerpt:    strings.TrimSpace(req.Excerpt),
		UpdateDate: updateDate,
		ImageURL:   strings.TrimSpace(req.ImageURL),
	}

	if err := validateCommand(command); err != nil {
		return Command{}, err
	}

	return command, nil
}

func validateCommand(command Command) error {
	if command.ID == "" ||
		command.Title == "" ||
		command.Excerpt == "" {
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
