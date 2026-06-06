package branches

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidInput = errors.New("invalid branch input")

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) List(ctx context.Context) ([]Branch, error) {
	return s.repository.List(ctx)
}

func (s Service) Create(ctx context.Context, req CreateRequest) (Branch, error) {
	command := Command{
		ID:        generateID("br"),
		Name:      strings.TrimSpace(req.Name),
		Address:   strings.TrimSpace(req.Address),
		Services:  strings.TrimSpace(req.Services),
		Phone:     strings.TrimSpace(req.Phone),
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		ImageURL:  strings.TrimSpace(req.ImageURL),
	}

	if err := validateCommand(command); err != nil {
		return Branch{}, err
	}

	return s.repository.Create(ctx, command)
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest) (Branch, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Branch{}, ErrInvalidInput
	}

	current, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return Branch{}, err
	}

	command := Command{
		ID:        current.ID,
		Name:      current.Name,
		Address:   current.Address,
		Services:  current.Services,
		Phone:     current.Phone,
		Latitude:  current.Latitude,
		Longitude: current.Longitude,
		ImageURL:  current.ImageURL,
	}

	if req.Name != nil {
		command.Name = strings.TrimSpace(*req.Name)
	}

	if req.Address != nil {
		command.Address = strings.TrimSpace(*req.Address)
	}

	if req.Services != nil {
		command.Services = strings.TrimSpace(*req.Services)
	}

	if req.Phone != nil {
		command.Phone = strings.TrimSpace(*req.Phone)
	}

	if req.Latitude != nil {
		command.Latitude = *req.Latitude
	}

	if req.Longitude != nil {
		command.Longitude = *req.Longitude
	}

	if req.ImageURL != nil {
		command.ImageURL = strings.TrimSpace(*req.ImageURL)
	}

	if err := validateCommand(command); err != nil {
		return Branch{}, err
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

func validateCommand(command Command) error {
	if command.ID == "" ||
		command.Name == "" ||
		command.Address == "" ||
		command.Services == "" ||
		command.Phone == "" {
		return ErrInvalidInput
	}

	if command.Latitude < -90 || command.Latitude > 90 {
		return ErrInvalidInput
	}

	if command.Longitude < -180 || command.Longitude > 180 {
		return ErrInvalidInput
	}

	return nil
}

func generateID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}
