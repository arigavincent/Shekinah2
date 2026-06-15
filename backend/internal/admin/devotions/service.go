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

type importPlan struct {
	rowNumber int
	req       CreateRequest
	existing  *Devotion
	action    string
	errors    []string
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
		Created:  make([]Devotion, 0),
		Updated:  make([]Devotion, 0),
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
		ExternalID:   current.ExternalID,
		Title:        current.Title,
		Excerpt:      current.Excerpt,
		DevotionDate: currentDate,
		PublishedAt:  publishedAt,
		ImageURL:     current.ImageURL,
		Body:         current.Body,
	}

	if req.ExternalID != nil {
		command.ExternalID = strings.TrimSpace(*req.ExternalID)
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

func (s Service) applyImportPlan(ctx context.Context, plan importPlan) (Devotion, error) {
	req := plan.req
	if plan.existing != nil {
		req.ExternalID = plan.existing.ExternalID
	}

	command, err := createCommandFromRequest(req)
	if err != nil {
		return Devotion{}, ErrInvalidInput
	}

	if plan.existing != nil {
		command.ID = plan.existing.ID
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

	required := []string{"externalid", "title", "excerpt", "devotiondate", "publishedat", "imageurl", "body"}
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
			Title:        csvValue(record, indexByName, "title"),
			Excerpt:      csvValue(record, indexByName, "excerpt"),
			DevotionDate: csvValue(record, indexByName, "devotiondate"),
			PublishedAt:  csvValue(record, indexByName, "publishedat"),
			ImageURL:     csvValue(record, indexByName, "imageurl"),
			Body:         csvValue(record, indexByName, "body"),
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
			plan.errors = []string{"row failed validation. Check externalId, date, publish time, title, excerpt, imageUrl, and body."}
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
	devotionDate, err := parseDate(req.DevotionDate)
	if err != nil {
		return Command{}, ErrInvalidInput
	}

	publishedAt, err := parsePublishedAtWithFallback(req.PublishedAt, devotionDate)
	if err != nil {
		return Command{}, ErrInvalidInput
	}

	id := generateID("dev")
	externalID := strings.TrimSpace(req.ExternalID)
	if externalID == "" {
		externalID = id
	}

	command := Command{
		ID:           id,
		ExternalID:   externalID,
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
		command.ExternalID == "" ||
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
