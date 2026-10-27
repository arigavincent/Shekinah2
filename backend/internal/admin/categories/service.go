package categories

import (
	"context"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidInput = errors.New("invalid category input")

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) List(ctx context.Context) ([]Category, error) {
	return s.repository.List(ctx)
}

func (s Service) Create(ctx context.Context, req CreateRequest) (Category, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > 60 {
		return Category{}, ErrInvalidInput
	}
	return s.repository.Create(ctx, newID(name), name, strings.TrimSpace(req.ImageURL))
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest) (Category, error) {
	current, err := s.repository.FindByID(ctx, strings.TrimSpace(id))
	if err != nil {
		return Category{}, err
	}

	name, image := current.Name, current.ImageURL
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if req.ImageURL != nil {
		image = strings.TrimSpace(*req.ImageURL)
	}
	if name == "" || len(name) > 60 {
		return Category{}, ErrInvalidInput
	}

	return s.repository.Update(ctx, current.ID, name, image)
}

func (s Service) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidInput
	}
	return s.repository.Delete(ctx, id)
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// newID builds a readable, unique id such as "cat-faith-lk2x9".
func newID(name string) string {
	slug := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if len(slug) > 32 {
		slug = slug[:32]
	}
	if slug == "" {
		slug = "category"
	}
	return "cat-" + slug + "-" + strconv.FormatInt(time.Now().UnixNano()%46656, 36)
}
