package sermons

import "time"

type Sermon struct {
	ID           string    `json:"id"`
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

type ImportRowError struct {
	RowNumber int    `json:"rowNumber"`
	Error     string `json:"error"`
}

type ImportResult struct {
	Imported []Sermon         `json:"imported"`
	Rejected []ImportRowError `json:"rejected"`
}

type Command struct {
	ID           string
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
