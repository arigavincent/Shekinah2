package sermons

import (
	"context"
	"encoding/csv"
	"errors"
	"io"
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

	required := []string{
		"type", "title", "speaker", "sermondate", "publishedat", "categoryid",
		"islive", "thumbnailurl", "duration", "description", "mediaurl",
	}
	for _, key := range required {
		if _, ok := indexByName[key]; !ok {
			return ImportResult{}, ErrInvalidInput
		}
	}

	result := ImportResult{
		Imported: make([]Sermon, 0),
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
			result.Rejected = append(result.Rejected, ImportRowError{
				RowNumber: rowNumber,
				Error:     "invalid CSV row",
			})
			continue
		}

		req := CreateRequest{
			Type:         csvValue(record, indexByName, "type"),
			Title:        csvValue(record, indexByName, "title"),
			Speaker:      csvValue(record, indexByName, "speaker"),
			SermonDate:   csvValue(record, indexByName, "sermondate"),
			PublishedAt:  csvValue(record, indexByName, "publishedat"),
			CategoryID:   csvValue(record, indexByName, "categoryid"),
			ThumbnailURL: csvValue(record, indexByName, "thumbnailurl"),
			Duration:     csvValue(record, indexByName, "duration"),
			Description:  csvValue(record, indexByName, "description"),
			MediaURL:     csvValue(record, indexByName, "mediaurl"),
		}

		if raw := strings.ToLower(csvValue(record, indexByName, "islive")); raw == "true" || raw == "1" || raw == "yes" {
			req.IsLive = true
		}

		item, err := s.Create(ctx, req)
		if err != nil {
			result.Rejected = append(result.Rejected, ImportRowError{
				RowNumber: rowNumber,
				Error:     "invalid sermon row",
			})
			continue
		}

		result.Imported = append(result.Imported, item)
	}

	return result, nil
}

func (s Service) Update(ctx context.Context, id string, req UpdateRequest) (Sermon, error) {
	current, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return Sermon{}, err
	}

	sermonDate, err := parseDate(current.SermonDate)
	if err != nil {
		return Sermon{}, ErrInvalidInput
	}

	publishedAt, err := parsePublishedAt(current.PublishedAt)
	if err != nil {
		return Sermon{}, ErrInvalidInput
	}

	command := Command{
		ID:           current.ID,
		Type:         current.Type,
		Title:        current.Title,
		Speaker:      current.Speaker,
		SermonDate:   sermonDate,
		PublishedAt:  publishedAt,
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

	if req.PublishedAt != nil {
		parsed, err := parsePublishedAtWithFallback(*req.PublishedAt, command.SermonDate)
		if err != nil {
			return Sermon{}, ErrInvalidInput
		}
		command.PublishedAt = parsed
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

	publishedAt, err := parsePublishedAtWithFallback(req.PublishedAt, sermonDate)
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
		PublishedAt:  publishedAt,
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

	if command.PublishedAt.IsZero() {
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

func parsePublishedAtWithFallback(value string, sermonDate time.Time) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Date(
			sermonDate.Year(),
			sermonDate.Month(),
			sermonDate.Day(),
			0,
			0,
			0,
			0,
			time.UTC,
		), nil
	}

	return parsePublishedAt(value)
}

func normalize(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
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
