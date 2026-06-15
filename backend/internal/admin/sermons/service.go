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

type importPlan struct {
	rowNumber int
	req       CreateRequest
	existing  *Sermon
	action    string
	errors    []string
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

func (s Service) PreviewImport(ctx context.Context, csvPayload string) (ImportPreview, error) {
	plans, err := s.buildImportPlans(ctx, csvPayload)
	if err != nil {
		return ImportPreview{}, err
	}

	preview := ImportPreview{
		Rows: make([]ImportPreviewRow, 0, len(plans)),
	}

	for _, plan := range plans {
		row := ImportPreviewRow{
			RowNumber:   plan.rowNumber,
			ExternalID:  plan.req.ExternalID,
			Title:       plan.req.Title,
			Action:      plan.action,
			PublishedAt: plan.req.PublishedAt,
			Errors:      append([]string(nil), plan.errors...),
		}

		if plan.existing != nil {
			row.ExistingID = plan.existing.ID
		}

		switch plan.action {
		case "create":
			preview.Creates++
		case "update":
			preview.Updates++
		default:
			preview.Rejected++
		}

		preview.Rows = append(preview.Rows, row)
	}

	return preview, nil
}

func (s Service) Import(ctx context.Context, csvPayload string) (ImportResult, error) {
	plans, err := s.buildImportPlans(ctx, csvPayload)
	if err != nil {
		return ImportResult{}, err
	}

	result := ImportResult{
		Created:  make([]Sermon, 0),
		Updated:  make([]Sermon, 0),
		Rejected: make([]ImportRowError, 0),
	}

	for _, plan := range plans {
		if len(plan.errors) > 0 || plan.action == "reject" {
			result.Rejected = append(result.Rejected, ImportRowError{
				RowNumber:  plan.rowNumber,
				ExternalID: plan.req.ExternalID,
				Title:      plan.req.Title,
				Error:      strings.Join(plan.errors, "; "),
			})
			continue
		}

		item, err := s.applyImportPlan(ctx, plan)
		if err != nil {
			result.Rejected = append(result.Rejected, ImportRowError{
				RowNumber:  plan.rowNumber,
				ExternalID: plan.req.ExternalID,
				Title:      plan.req.Title,
				Error:      err.Error(),
			})
			continue
		}

		if plan.action == "update" {
			result.Updated = append(result.Updated, item)
			continue
		}

		result.Created = append(result.Created, item)
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
		ExternalID:   current.ExternalID,
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

	if req.ExternalID != nil {
		command.ExternalID = strings.TrimSpace(*req.ExternalID)
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

func (s Service) applyImportPlan(ctx context.Context, plan importPlan) (Sermon, error) {
	req := plan.req
	if plan.existing != nil {
		req.ID = plan.existing.ID
	}

	command, err := createCommandFromRequest(req)
	if err != nil {
		return Sermon{}, ErrInvalidInput
	}

	if plan.existing != nil {
		return s.repository.Update(ctx, command)
	}

	return s.repository.Create(ctx, command)
}

func (s Service) buildImportPlans(ctx context.Context, csvPayload string) ([]importPlan, error) {
	reader := csv.NewReader(strings.NewReader(strings.TrimSpace(csvPayload)))
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil, ErrInvalidInput
		}
		return nil, ErrInvalidInput
	}

	indexByName := make(map[string]int, len(header))
	for idx, name := range header {
		indexByName[strings.TrimSpace(strings.ToLower(name))] = idx
	}

	required := []string{
		"externalid", "type", "title", "speaker", "sermondate", "publishedat", "categoryid",
		"islive", "thumbnailurl", "duration", "description", "mediaurl",
	}
	for _, key := range required {
		if _, ok := indexByName[key]; !ok {
			return nil, ErrInvalidInput
		}
	}

	plans := make([]importPlan, 0)
	rowNumber := 1
	for {
		rowNumber++
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			plans = append(plans, importPlan{
				rowNumber: rowNumber,
				action:    "reject",
				errors:    []string{"invalid CSV row"},
			})
			continue
		}

		req := CreateRequest{
			ExternalID:   csvValue(record, indexByName, "externalid"),
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

		plan := importPlan{
			rowNumber: rowNumber,
			req:       req,
		}

		if strings.TrimSpace(req.ExternalID) == "" {
			plan.action = "reject"
			plan.errors = []string{"externalId is required for idempotent batch import"}
			plans = append(plans, plan)
			continue
		}

		if _, err := createCommandFromRequest(req); err != nil {
			plan.action = "reject"
			plan.errors = []string{"row failed validation. Check externalId, type, date, publish time, title, speaker, description, and media URL."}
			plans = append(plans, plan)
			continue
		}

		existing, err := s.repository.FindByExternalID(ctx, req.ExternalID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				plan.action = "create"
				plans = append(plans, plan)
				continue
			}

			return nil, err
		}

		plan.action = "update"
		plan.existing = &existing
		plans = append(plans, plan)
	}

	if len(plans) == 0 {
		return nil, ErrInvalidInput
	}

	return plans, nil
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

	externalID := strings.TrimSpace(req.ExternalID)
	if externalID == "" {
		externalID = id
	}

	command := Command{
		ID:           id,
		ExternalID:   externalID,
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
		command.ExternalID == "" ||
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
