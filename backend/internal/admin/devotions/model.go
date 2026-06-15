package devotions

import "time"

type Devotion struct {
	ID           string    `json:"id"`
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
	Title        string `json:"title"`
	Excerpt      string `json:"excerpt"`
	DevotionDate string `json:"devotionDate"`
	PublishedAt  string `json:"publishedAt"`
	ImageURL     string `json:"imageUrl"`
	Body         string `json:"body"`
}

type UpdateRequest struct {
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

type ImportRowError struct {
	RowNumber int    `json:"rowNumber"`
	Error     string `json:"error"`
}

type ImportResult struct {
	Imported []Devotion       `json:"imported"`
	Rejected []ImportRowError `json:"rejected"`
}

type Command struct {
	ID           string
	Title        string
	Excerpt      string
	DevotionDate time.Time
	PublishedAt  time.Time
	ImageURL     string
	Body         string
}
