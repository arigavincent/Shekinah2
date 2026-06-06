package events

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidInput = errors.New("invalid event input")

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) List(ctx context.Context) ([]Event, error) {
	return s.repository.List(ctx)
}

func (s Service) Create(ctx context.Context, req CreateRequest) (Event, error) {
	command, err := createCommandFromRequest(req)
	if err != nil {
		return Event{}, err
	}

	return s.repository.Create(ctx, command)
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest) (Event, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Event{}, ErrInvalidInput
	}

	current, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return Event{}, err
	}

	currentDate, err := parseDate(current.EventDate)
	if err != nil {
		return Event{}, ErrInvalidInput
	}

	command := Command{
		ID:          current.ID,
		Title:       current.Title,
		EventDate:   currentDate,
		EventTime:   current.EventTime,
		Location:    current.Location,
		ImageURL:    current.ImageURL,
		Description: current.Description,
	}

	if req.Title != nil {
		command.Title = strings.TrimSpace(*req.Title)
	}

	if req.EventDate != nil {
		parsed, err := parseDate(*req.EventDate)
		if err != nil {
			return Event{}, ErrInvalidInput
		}

		command.EventDate = parsed
	}

	if req.EventTime != nil {
		command.EventTime = strings.TrimSpace(*req.EventTime)
	}

	if req.Location != nil {
		command.Location = strings.TrimSpace(*req.Location)
	}

	if req.ImageURL != nil {
		command.ImageURL = strings.TrimSpace(*req.ImageURL)
	}

	if req.Description != nil {
		command.Description = strings.TrimSpace(*req.Description)
	}

	if err := validateCommand(command); err != nil {
		return Event{}, err
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
	eventDate, err := parseDate(req.EventDate)
	if err != nil {
		return Command{}, ErrInvalidInput
	}

	command := Command{
		ID:          generateID("evt"),
		Title:       strings.TrimSpace(req.Title),
		EventDate:   eventDate,
		EventTime:   strings.TrimSpace(req.EventTime),
		Location:    strings.TrimSpace(req.Location),
		ImageURL:    strings.TrimSpace(req.ImageURL),
		Description: strings.TrimSpace(req.Description),
	}

	if err := validateCommand(command); err != nil {
		return Command{}, err
	}

	return command, nil
}

func validateCommand(command Command) error {
	if command.ID == "" ||
		command.Title == "" ||
		command.EventTime == "" ||
		command.Location == "" ||
		command.Description == "" {
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
