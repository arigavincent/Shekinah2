package events

import (
	"context"
	"errors"
	"github.com/ariga/shekinah-backend/internal/eventreg"
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
	if req.ID != "" {
		if existing, e := s.repository.FindByID(ctx, req.ID); e == nil {
			if existing.Title != strings.TrimSpace(req.Title) {
				return Event{}, ErrInvalidInput
			}
			return existing, nil
		}
	}
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
		PublishedAt: current.PublishedAt, IsPublished: current.IsPublished, NotifyOnPublish: current.NotifyOnPublish,
		ID:          current.ID,
		Title:       current.Title,
		EventDate:   currentDate,
		EventTime:   current.EventTime,
		Location:    current.Location,
		ImageURL:    current.ImageURL,
		Description: current.Description,
	}

	if req.PublishedAt != nil {
		v, e := parsePublication(*req.PublishedAt)
		if e != nil {
			return Event{}, ErrInvalidInput
		}
		command.PublishedAt = v
	}
	if req.IsPublished != nil {
		command.IsPublished = *req.IsPublished
	}
	if req.NotifyOnPublish != nil {
		command.NotifyOnPublish = *req.NotifyOnPublish
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
		PublishedAt: time.Now().UTC(), IsPublished: req.IsPublished == nil || *req.IsPublished, NotifyOnPublish: req.NotifyOnPublish == nil || *req.NotifyOnPublish,
		Title:       strings.TrimSpace(req.Title),
		EventDate:   eventDate,
		EventTime:   strings.TrimSpace(req.EventTime),
		Location:    strings.TrimSpace(req.Location),
		ImageURL:    strings.TrimSpace(req.ImageURL),
		Description: strings.TrimSpace(req.Description),
	}

	if req.RegistrationSetup != nil {
		normalized, e := eventreg.NormalizeSetup(*req.RegistrationSetup)
		if e != nil {
			return Command{}, ErrInvalidInput
		}
		command.Setup = normalized
	} else {
		command.Setup = eventreg.Setup{Mode: "none", Fields: []eventreg.Field{}}
	}
	if req.ID != "" {
		command.ID = req.ID
	}
	if req.PublishedAt != "" {
		v, e := parsePublication(req.PublishedAt)
		if e != nil {
			return Command{}, ErrInvalidInput
		}
		command.PublishedAt = v
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

func parsePublication(value string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04Z07:00", "2006-01-02T15:04", "2006-01-02 15:04"} {
		if v, e := time.ParseInLocation(layout, strings.TrimSpace(value), time.FixedZone("Africa/Nairobi", 10800)); e == nil {
			return v.UTC(), nil
		}
	}
	return time.Time{}, ErrInvalidInput
}
