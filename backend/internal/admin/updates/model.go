package updates

import "time"

type Update struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Excerpt    string    `json:"excerpt"`
	UpdateDate string    `json:"updateDate"`
	ImageURL   string    `json:"imageUrl"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	Title      string `json:"title"`
	Excerpt    string `json:"excerpt"`
	UpdateDate string `json:"updateDate"`
	ImageURL   string `json:"imageUrl"`
}

type UpdateRequest struct {
	Title      *string `json:"title"`
	Excerpt    *string `json:"excerpt"`
	UpdateDate *string `json:"updateDate"`
	ImageURL   *string `json:"imageUrl"`
}

type Command struct {
	ID         string
	Title      string
	Excerpt    string
	UpdateDate time.Time
	ImageURL   string
}
