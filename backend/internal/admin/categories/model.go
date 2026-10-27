package categories

import "time"

type Category struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	ImageURL    string    `json:"imageUrl"`
	SermonCount int       `json:"sermonCount"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	Name     string `json:"name"`
	ImageURL string `json:"imageUrl"`
}

type UpdateRequest struct {
	Name     *string `json:"name"`
	ImageURL *string `json:"imageUrl"`
}
