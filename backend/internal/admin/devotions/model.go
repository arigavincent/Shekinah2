package devotions

import "time"

type Devotion struct {
	ID           string    `json:"id"`
	ExternalID   string    `json:"externalId"`
	Title        string    `json:"title"`
	Excerpt      string    `json:"excerpt"`
	DevotionDate string    `json:"devotionDate"`
	PublishedAt  string    `json:"publishedAt"`
	ImageURL     string    `json:"imageUrl"`
	Body         string    `json:"body"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	ExternalID   string `json:"externalId"`
	Title        string `json:"title"`
	Excerpt      string `json:"excerpt"`
	DevotionDate string `json:"devotionDate"`
	PublishedAt  string `json:"publishedAt"`
	ImageURL     string `json:"imageUrl"`
	Body         string `json:"body"`
}

type UpdateRequest struct {
	ExternalID   *string `json:"externalId"`
	Title        *string `json:"title"`
	Excerpt      *string `json:"excerpt"`
	DevotionDate *string `json:"devotionDate"`
	PublishedAt  *string `json:"publishedAt"`
	ImageURL     *string `json:"imageUrl"`
	Body         *string `json:"body"`
}

type ImportRequest struct {
	CSV string `json:"csv"`
}

type ImportPreviewRow struct {
	RowNumber   int      `json:"rowNumber"`
	ExternalID  string   `json:"externalId"`
	Title       string   `json:"title"`
	Action      string   `json:"action"`
	ExistingID  string   `json:"existingId,omitempty"`
	PublishedAt string   `json:"publishedAt,omitempty"`
	Errors      []string `json:"errors,omitempty"`
}

type ImportPreview struct {
	Rows     []ImportPreviewRow `json:"rows"`
	Creates  int                `json:"creates"`
	Updates  int                `json:"updates"`
	Rejected int                `json:"rejected"`
}

type ImportRowError struct {
	RowNumber  int    `json:"rowNumber"`
	ExternalID string `json:"externalId,omitempty"`
	Title      string `json:"title,omitempty"`
	Error      string `json:"error"`
}

type ImportResult struct {
	Created  []Devotion       `json:"created"`
	Updated  []Devotion       `json:"updated"`
	Rejected []ImportRowError `json:"rejected"`
}

type Command struct {
	ID           string
	ExternalID   string
	Title        string
	Excerpt      string
	DevotionDate time.Time
	PublishedAt  time.Time
	ImageURL     string
	Body         string
}
