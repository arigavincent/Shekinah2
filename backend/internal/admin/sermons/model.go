package sermons

import "time"

type Sermon struct {
	ID           string    `json:"id"`
	ExternalID   string    `json:"externalId"`
	Type         string    `json:"type"`
	Title        string    `json:"title"`
	Speaker      string    `json:"speaker"`
	SermonDate   string    `json:"sermonDate"`
	PublishedAt  string    `json:"publishedAt"`
	CategoryID   string    `json:"categoryId"`
	Category     string    `json:"category"`
	IsLive       bool      `json:"isLive"`
	ThumbnailURL string    `json:"thumbnailUrl"`
	Duration     string    `json:"duration"`
	Description  string    `json:"description"`
	MediaURL     string    `json:"mediaUrl"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	ID           string `json:"id"`
	ExternalID   string `json:"externalId"`
	Type         string `json:"type"`
	Title        string `json:"title"`
	Speaker      string `json:"speaker"`
	SermonDate   string `json:"sermonDate"`
	PublishedAt  string `json:"publishedAt"`
	CategoryID   string `json:"categoryId"`
	IsLive       bool   `json:"isLive"`
	ThumbnailURL string `json:"thumbnailUrl"`
	Duration     string `json:"duration"`
	Description  string `json:"description"`
	MediaURL     string `json:"mediaUrl"`
}

type UpdateRequest struct {
	ExternalID   *string `json:"externalId"`
	Type         *string `json:"type"`
	Title        *string `json:"title"`
	Speaker      *string `json:"speaker"`
	SermonDate   *string `json:"sermonDate"`
	PublishedAt  *string `json:"publishedAt"`
	CategoryID   *string `json:"categoryId"`
	IsLive       *bool   `json:"isLive"`
	ThumbnailURL *string `json:"thumbnailUrl"`
	Duration     *string `json:"duration"`
	Description  *string `json:"description"`
	MediaURL     *string `json:"mediaUrl"`
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
	Created  []Sermon         `json:"created"`
	Updated  []Sermon         `json:"updated"`
	Rejected []ImportRowError `json:"rejected"`
}

type Command struct {
	ID           string
	ExternalID   string
	Type         string
	Title        string
	Speaker      string
	SermonDate   time.Time
	PublishedAt  time.Time
	CategoryID   string
	IsLive       bool
	ThumbnailURL string
	Duration     string
	Description  string
	MediaURL     string
}
