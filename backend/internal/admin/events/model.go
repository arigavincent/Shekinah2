package events

import "time"

type Event struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	EventDate   string    `json:"eventDate"`
	EventTime   string    `json:"eventTime"`
	Location    string    `json:"location"`
	ImageURL    string    `json:"imageUrl"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	Title       string `json:"title"`
	EventDate   string `json:"eventDate"`
	EventTime   string `json:"eventTime"`
	Location    string `json:"location"`
	ImageURL    string `json:"imageUrl"`
	Description string `json:"description"`
}

type UpdateRequest struct {
	Title       *string `json:"title"`
	EventDate   *string `json:"eventDate"`
	EventTime   *string `json:"eventTime"`
	Location    *string `json:"location"`
	ImageURL    *string `json:"imageUrl"`
	Description *string `json:"description"`
}

type Command struct {
	ID          string
	Title       string
	EventDate   time.Time
	EventTime   string
	Location    string
	ImageURL    string
	Description string
}
