package events

import (
	"github.com/ariga/shekinah-backend/internal/eventreg"
	"time"
)

type Event struct {
	PublishedAt     time.Time `json:"publishedAt"`
	IsPublished     bool      `json:"isPublished"`
	NotifyOnPublish bool      `json:"notifyOnPublish"`
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	EventDate       string    `json:"eventDate"`
	EventTime       string    `json:"eventTime"`
	Location        string    `json:"location"`
	ImageURL        string    `json:"imageUrl"`
	Description     string    `json:"description"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
	// Cancelled events stay for the records but leave the app.
	CancelledAt          *time.Time `json:"cancelledAt"`
	CancelReason         string     `json:"cancelReason"`
	RegistrationClosesAt *time.Time `json:"registrationClosesAt"`
}

type CreateRequest struct {
	RegistrationSetup *eventreg.Setup `json:"registrationSetup"`
	ID                string          `json:"id"`
	PublishedAt       string          `json:"publishedAt"`
	IsPublished       *bool           `json:"isPublished"`
	NotifyOnPublish   *bool           `json:"notifyOnPublish"`
	Title             string          `json:"title"`
	EventDate         string          `json:"eventDate"`
	EventTime         string          `json:"eventTime"`
	Location          string          `json:"location"`
	ImageURL          string          `json:"imageUrl"`
	Description       string          `json:"description"`
}

type UpdateRequest struct {
	PublishedAt     *string `json:"publishedAt"`
	IsPublished     *bool   `json:"isPublished"`
	NotifyOnPublish *bool   `json:"notifyOnPublish"`
	Title           *string `json:"title"`
	EventDate       *string `json:"eventDate"`
	EventTime       *string `json:"eventTime"`
	Location        *string `json:"location"`
	ImageURL        *string `json:"imageUrl"`
	Description     *string `json:"description"`
}

type Command struct {
	Setup           eventreg.Setup
	PublishedAt     time.Time
	IsPublished     bool
	NotifyOnPublish bool
	ID              string
	Title           string
	EventDate       time.Time
	EventTime       string
	Location        string
	ImageURL        string
	Description     string
}
