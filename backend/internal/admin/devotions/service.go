package devotions

import (
	"context"
	"encoding/csv"
	"errors"
	"io"
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

func (s Service) Import(ctx context.Context, csvPayload string) (ImportResult, error) {
	reader := csv.NewReader(strings.NewReader(strings.TrimSpace(csvPayload)))
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return ImportResult{}, ErrInvalidInput
		}
		return ImportResult{}, ErrInvalidInput
	}

	indexByName := make(map[string]int, len(header))
	for idx, name := range header {
		indexByName[strings.TrimSpace(strings.ToLower(name))] = idx
	}

	required := []string{"title", "excerpt", "devotiondate", "publishedat", "imageurl", "body"}
	for _, key := range required {
		if _, ok := indexByName[key]; !ok {
			return ImportResult{}, ErrInvalidInput
		}
	}

	result := ImportResult{
		Imported: make([]Devotion, 0),
		Rejected: make([]ImportRowError, 0),
	}

	rowNumber := 1
	for {
		rowNumber++
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			result.Rejected = append(result.Rejected, ImportRowError{RowNumber: rowNumber, Error: "invalid CSV row"})
			continue
		}

		req := CreateRequest{
			Title:        csvValue(record, indexByName, "title"),
			Excerpt:      csvValue(record, indexByName, "excerpt"),
			DevotionDate: csvValue(record, indexByName, "devotiondate"),
			PublishedAt:  csvValue(record, indexByName, "publishedat"),
			ImageURL:     csvValue(record, indexByName, "imageurl"),
			Body:         csvValue(record, indexByName, "body"),
		}

		item, err := s.Create(ctx, req)
		if err != nil {
			result.Rejected = append(result.Rejected, ImportRowError{RowNumber: rowNumber, Error: "invalid devotion row"})
			continue
		}

		result.Imported = append(result.Imported, item)
	}

	return result, nil
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

	publishedAt, err := parsePublishedAt(current.PublishedAt)
	if err != nil {
		return Devotion{}, ErrInvalidInput
	}

	command := Command{
		ID:           current.ID,
		Title:        current.Title,
		Excerpt:      current.Excerpt,
		DevotionDate: currentDate,
		PublishedAt:  publishedAt,
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

	if req.PublishedAt != nil {
		parsed, err := parsePublishedAtWithFallback(*req.PublishedAt, command.DevotionDate)
		if err != nil {
			return Devotion{}, ErrInvalidInput
		}
		command.PublishedAt = parsed
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

	publishedAt, err := parsePublishedAtWithFallback(req.PublishedAt, devotionDate)
	if err != nil {
		return Command{}, ErrInvalidInput
	}

	command := Command{
		ID:           generateID("dev"),
		Title:        strings.TrimSpace(req.Title),
		Excerpt:      strings.TrimSpace(req.Excerpt),
		DevotionDate: devotionDate,
		PublishedAt:  publishedAt,
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
		command.Body == "" ||
		command.PublishedAt.IsZero() {
		return ErrInvalidInput
	}

	return nil
}

func parseDate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", strings.TrimSpace(value))
}

func parsePublishedAt(value string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04",
		"2006-01-02 15:04",
		"2006-01-02",
	}

	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.UTC(), nil
		}
	}

	return time.Time{}, ErrInvalidInput
}

func parsePublishedAtWithFallback(value string, devotionDate time.Time) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Date(
			devotionDate.Year(),
			devotionDate.Month(),
			devotionDate.Day(),
			0,
			0,
			0,
			0,
			time.UTC,
		), nil
	}

	return parsePublishedAt(value)
}

func generateID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func csvValue(record []string, indexByName map[string]int, key string) string {
	idx, ok := indexByName[key]
	if !ok || idx < 0 || idx >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[idx])
}
