package liveconfig

import "time"

type LiveConfig struct {
	ID                     string    `json:"id"`
	IsLive                 bool      `json:"isLive"`
	Title                  string    `json:"title"`
	Viewers                string    `json:"viewers"`
	NextService            string    `json:"nextService"`
	YoutubeID              string    `json:"youtubeId"`
	Provider               string    `json:"provider"`
	CloudflareLiveInputID  string    `json:"cloudflareLiveInputId,omitempty"`
	CloudflarePlaybackUID  string    `json:"cloudflarePlaybackUid,omitempty"`
	PlaybackHLSURL         string    `json:"playbackHlsUrl,omitempty"`
	PlaybackDASHURL        string    `json:"playbackDashUrl,omitempty"`
	EmbedURL               string    `json:"embedUrl,omitempty"`
	RTMPSURL               string    `json:"rtmpsUrl,omitempty"`
	SRTURL                 string    `json:"srtUrl,omitempty"`
	SRTStreamID            string    `json:"srtStreamId,omitempty"`
	StreamKey              string    `json:"streamKey,omitempty"`
	SRTPassphrase          string    `json:"srtPassphrase,omitempty"`
	ReplayURL              string    `json:"replayUrl,omitempty"`
	HasCloudflareLiveInput bool      `json:"hasCloudflareLiveInput"`
	UpdatedAt              time.Time `json:"updatedAt"`
}

type UpdateRequest struct {
	IsLive      *bool   `json:"isLive"`
	Title       *string `json:"title"`
	Viewers     *string `json:"viewers"`
	NextService *string `json:"nextService"`
	YoutubeID   *string `json:"youtubeId"`
	Provider    *string `json:"provider"`
	ReplayURL   *string `json:"replayUrl"`
}

type Command struct {
	ID                    string
	IsLive                bool
	Title                 string
	Viewers               string
	NextService           string
	YoutubeID             string
	Provider              string
	CloudflareLiveInputID string
	CloudflarePlaybackUID string
	PlaybackHLSURL        string
	PlaybackDASHURL       string
	EmbedURL              string
	RTMPSURL              string
	SRTURL                string
	SRTStreamID           string
	StreamKey             string
	SRTPassphrase         string
	ReplayURL             string
}

type CloudflareLiveInput struct {
	UID           string
	RTMPSURL      string
	StreamKey     string
	SRTURL        string
	SRTStreamID   string
	SRTPassphrase string
}
