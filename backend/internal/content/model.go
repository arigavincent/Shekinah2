package content

type HomeResponse struct {
	Scripture  Scripture             `json:"scripture"`
	Live       LiveStream            `json:"live"`
	Devotions  []Devotion            `json:"devotions"`
	Sermons    []Sermon              `json:"sermons"`
	Categories []Category            `json:"categories"`
	Clips      []Clip                `json:"clips"`
	Events     []Event               `json:"events"`
	Branches   []Branch              `json:"branches"`
	Updates    []Update              `json:"updates"`
	Platforms  map[string][]Platform `json:"platforms"`
	Downloads  []Download            `json:"downloads"`
	Prayers    []Prayer              `json:"prayers"`
	About      About                 `json:"about"`
}

type Scripture struct {
	Title     string `json:"title"`
	Verse     string `json:"verse"`
	Reference string `json:"reference"`
}

type LiveStream struct {
	IsLive            bool   `json:"isLive"`
	Title             string `json:"title"`
	Viewers           string `json:"viewers"`
	NextService       string `json:"nextService"`
	YoutubeID         string `json:"youtubeId"`
	Provider          string `json:"provider"`
	PlaybackHLSURL    string `json:"playbackHlsUrl,omitempty"`
	PlaybackDASHURL   string `json:"playbackDashUrl,omitempty"`
	EmbedURL          string `json:"embedUrl,omitempty"`
	WebRTCPlaybackURL string `json:"webRtcPlaybackUrl,omitempty"`
	ReplayURL         string `json:"replayUrl,omitempty"`
}

type Devotion struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Excerpt  string `json:"excerpt"`
	Date     string `json:"date"`
	Image    string `json:"image"`
	ImageURL string `json:"imageUrl"`
	Body     string `json:"body"`
}

type Sermon struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Speaker     string `json:"speaker"`
	Date        string `json:"date"`
	Category    string `json:"category"`
	Live        bool   `json:"live"`
	Thumbnail   string `json:"thumbnail"`
	Duration    string `json:"duration,omitempty"`
	Description string `json:"description"`
	MediaURL    string `json:"mediaUrl,omitempty"`
}

type Category struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Count int    `json:"count"`
	Image string `json:"image"`
}

type Event struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Date        string `json:"date"`
	Time        string `json:"time"`
	Location    string `json:"location"`
	Image       string `json:"image"`
	ImageURL    string `json:"imageUrl"`
	Description string `json:"description"`
}

type Branch struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Address  string  `json:"address"`
	Services string  `json:"services"`
	Phone    string  `json:"phone"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Image    string  `json:"image"`
	ImageURL string  `json:"imageUrl"`
}

type Update struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Excerpt string `json:"excerpt"`
	Date    string `json:"date"`
	Image   string `json:"image"`
}

type Platform struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Link        string `json:"link,omitempty"`
}

type Clip struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Image    string `json:"image"`
	MediaURL string `json:"mediaUrl,omitempty"`
	Duration string `json:"duration,omitempty"`
}

type Download struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Size  string `json:"size"`
	Image string `json:"image"`
}

type Prayer struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Text     string `json:"text"`
	Date     string `json:"date"`
	Count    int    `json:"count"`
	Category string `json:"category,omitempty"`
	IsPublic bool   `json:"isPublic,omitempty"`
}

type About struct {
	Vision         string `json:"vision"`
	Description    string `json:"description"`
	ContactSummary string `json:"contactSummary"`
}
