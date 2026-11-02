package prayers

import "time"

type Prayer struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Text       string     `json:"text"`
	Count      int        `json:"count"`
	Category   string     `json:"category"`
	IsPublic   bool       `json:"isPublic"`
	OwnerEmail string     `json:"ownerEmail"`
	Status     string     `json:"status"`
	AdminNote  string     `json:"adminNote"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	ReviewedAt *time.Time `json:"reviewedAt,omitempty"`
	Pinned     bool       `json:"pinned"`
	// When its current period on the wall began (it leaves after the set number of days).
	ShownFrom time.Time `json:"shownFrom"`
}

type UpdateRequest struct {
	Status    *string `json:"status"`
	AdminNote *string `json:"adminNote"`
}

type Command struct {
	ID         string
	Status     string
	AdminNote  string
	ReviewedBy *string
	ReviewedAt *time.Time
}
