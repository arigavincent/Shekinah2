package liveconfig

import "time"

type LiveConfig struct {
	ID          string    `json:"id"`
	IsLive      bool      `json:"isLive"`
	Title       string    `json:"title"`
	Viewers     string    `json:"viewers"`
	NextService string    `json:"nextService"`
	YoutubeID   string    `json:"youtubeId"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type UpdateRequest struct {
	IsLive      *bool   `json:"isLive"`
	Title       *string `json:"title"`
	Viewers     *string `json:"viewers"`
	NextService *string `json:"nextService"`
	YoutubeID   *string `json:"youtubeId"`
}

type Command struct {
	ID          string
	IsLive      bool
	Title       string
	Viewers     string
	NextService string
	YoutubeID   string
}
