package prayers

import (
	"context"
	"errors"
	"strings"
	"time"
)

var ErrInvalidInput = errors.New("invalid prayer input")

var allowedStatuses = map[string]bool{
	"new":        true,
	"reviewed":   true,
	"prayed_for": true,
	"contacted":  true,
}

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) List(ctx context.Context) ([]Prayer, error) {
	return s.repository.List(ctx)
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest, reviewerID string) (Prayer, error) {
	id = strings.TrimSpace(id)
	reviewerID = strings.TrimSpace(reviewerID)
	if id == "" || reviewerID == "" {
		return Prayer{}, ErrInvalidInput
	}

	current, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return Prayer{}, err
	}

	command := Command{
		ID:        current.ID,
		Status:    current.Status,
		AdminNote: current.AdminNote,
	}

	if req.Status != nil {
		status := strings.TrimSpace(*req.Status)
		if !allowedStatuses[status] {
			return Prayer{}, ErrInvalidInput
		}

		command.Status = status
	}

	if req.AdminNote != nil {
		command.AdminNote = strings.TrimSpace(*req.AdminNote)
	}

	now := time.Now().UTC()
	command.ReviewedAt = &now
	command.ReviewedBy = &reviewerID

	return s.repository.Update(ctx, command)
}
