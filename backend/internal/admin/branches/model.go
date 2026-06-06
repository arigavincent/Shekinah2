package branches

import "time"

type Branch struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Services  string    `json:"services"`
	Phone     string    `json:"phone"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	ImageURL  string    `json:"imageUrl"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	Name      string  `json:"name"`
	Address   string  `json:"address"`
	Services  string  `json:"services"`
	Phone     string  `json:"phone"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	ImageURL  string  `json:"imageUrl"`
}

type UpdateRequest struct {
	Name      *string  `json:"name"`
	Address   *string  `json:"address"`
	Services  *string  `json:"services"`
	Phone     *string  `json:"phone"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	ImageURL  *string  `json:"imageUrl"`
}

type Command struct {
	ID        string
	Name      string
	Address   string
	Services  string
	Phone     string
	Latitude  float64
	Longitude float64
	ImageURL  string
}
