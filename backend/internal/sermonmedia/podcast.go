package sermonmedia

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	adminsermons "github.com/ariga/shekinah-backend/internal/admin/sermons"
)

// PodcastFetcher reads a podcast RSS feed, e.g. the one Spotify for
// Creators publishes for a show. Episodes carry direct audio files
// (enclosures), which the app plays in its own player.
type PodcastFetcher struct {
	httpClient *http.Client
}

func NewPodcastFetcher() PodcastFetcher {
	return PodcastFetcher{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

type PodcastEpisode struct {
	GUID        string
	Title       string
	Description string
	AudioURL    string
	ImageURL    string
	Author      string
	Duration    string
	PublishedAt time.Time
}

type rssFeed struct {
	Channel struct {
		Author string `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd author"`
		Image  struct {
			Href string `xml:"href,attr"`
		} `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd image"`
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Description string `xml:"description"`
	Summary     string `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd summary"`
	GUID        string `xml:"guid"`
	PubDate     string `xml:"pubDate"`
	Author      string `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd author"`
	Duration    string `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd duration"`
	Image       struct {
		Href string `xml:"href,attr"`
	} `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd image"`
	Enclosure struct {
		URL  string `xml:"url,attr"`
		Type string `xml:"type,attr"`
	} `xml:"enclosure"`
}

func (f PodcastFetcher) Fetch(ctx context.Context, feedURL string) ([]PodcastEpisode, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return nil, fmt.Errorf("prepare podcast request: %w", err)
	}
	req.Header.Set("User-Agent", "ShekinahSonsGlobal/1.0 (+podcast sync)")

	res, err := f.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch podcast feed: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode > 299 {
		return nil, fmt.Errorf("podcast feed returned %d", res.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(res.Body, 20_000_000))
	if err != nil {
		return nil, fmt.Errorf("read podcast feed: %w", err)
	}

	return ParsePodcastFeed(body)
}

// ParsePodcastFeed extracts playable episodes; items without audio are skipped.
func ParsePodcastFeed(body []byte) ([]PodcastEpisode, error) {
	var feed rssFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("parse podcast feed: %w", err)
	}

	episodes := make([]PodcastEpisode, 0, len(feed.Channel.Items))
	for _, item := range feed.Channel.Items {
		audio := strings.TrimSpace(item.Enclosure.URL)
		if audio == "" || (item.Enclosure.Type != "" && !strings.HasPrefix(item.Enclosure.Type, "audio/")) {
			continue
		}

		guid := strings.TrimSpace(item.GUID)
		if guid == "" {
			guid = audio
		}

		image := strings.TrimSpace(item.Image.Href)
		if image == "" {
			image = strings.TrimSpace(feed.Channel.Image.Href)
		}

		author := strings.TrimSpace(item.Author)
		if author == "" {
			author = strings.TrimSpace(feed.Channel.Author)
		}

		description := plainText(item.Description)
		if description == "" {
			description = plainText(item.Summary)
		}

		published, _ := parseRSSDate(item.PubDate)

		episodes = append(episodes, PodcastEpisode{
			GUID:        guid,
			Title:       strings.TrimSpace(html.UnescapeString(item.Title)),
			Description: description,
			AudioURL:    audio,
			ImageURL:    image,
			Author:      author,
			Duration:    normalizeITunesDuration(item.Duration),
			PublishedAt: published,
		})
	}

	return episodes, nil
}

var tagPattern = regexp.MustCompile(`<[^>]*>`)
var spacePattern = regexp.MustCompile(`\s+`)

func plainText(value string) string {
	text := tagPattern.ReplaceAllString(value, " ")
	text = html.UnescapeString(text)
	return strings.TrimSpace(spacePattern.ReplaceAllString(text, " "))
}

func parseRSSDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	for _, layout := range []string{time.RFC1123Z, time.RFC1123, "Mon, 2 Jan 2006 15:04:05 -0700", "Mon, 2 Jan 2006 15:04:05 MST", time.RFC3339} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, errors.New("unrecognised date")
}

// normalizeITunesDuration accepts "3725", "62:05" or "1:02:05".
func normalizeITunesDuration(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if seconds, err := strconv.Atoi(value); err == nil {
		return FormatDuration(float64(seconds))
	}
	return value
}

var codePattern = regexp.MustCompile(`^\s*([A-Za-z]{1,3}\.?\s?\d{1,4})\b[\s.:\-–—]*`)

// splitEpisodeTitle pulls a leading sermon code ("S.14 Title") off the title.
func splitEpisodeTitle(title string) (string, string) {
	match := codePattern.FindStringSubmatch(title)
	if match == nil {
		return "", strings.TrimSpace(title)
	}
	rest := strings.TrimSpace(title[len(match[0]):])
	if rest == "" {
		return "", strings.TrimSpace(title)
	}
	return match[1], rest
}

func (s Service) podcastFeedURL(ctx context.Context) (string, error) {
	var value string
	err := s.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = 'podcast_feed_url'`).Scan(&value)
	if err != nil {
		return "", nil
	}
	return strings.TrimSpace(value), nil
}

// syncPodcast creates an audio sermon for every new episode and keeps the
// audio URL of existing ones current. Admin edits to title, code, category
// or description are kept.
func (s Service) syncPodcast(ctx context.Context, report *SyncReport) error {
	feedURL, err := s.podcastFeedURL(ctx)
	if err != nil || feedURL == "" {
		return err
	}

	episodes, err := s.podcast.Fetch(ctx, feedURL)
	if err != nil {
		return err
	}

	for _, episode := range episodes {
		externalID := "podcast:" + episode.GUID

		existing, err := s.repository.FindByExternalID(ctx, externalID)
		if err == nil {
			if existing.MediaURL != episode.AudioURL {
				audio := episode.AudioURL
				if _, err := s.sermons.Update(ctx, existing.ID, adminsermons.UpdateRequest{MediaURL: &audio}); err != nil {
					report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", existing.ID, err))
					continue
				}
				report.PodcastUpdated++
			}
			continue
		}
		if !errors.Is(err, adminsermons.ErrNotFound) {
			report.Errors = append(report.Errors, err.Error())
			continue
		}

		code, title := splitEpisodeTitle(episode.Title)
		published := episode.PublishedAt
		if published.IsZero() {
			published = time.Now()
		}
		speaker := episode.Author
		if speaker == "" {
			speaker = "Shekinah Sons Global"
		}
		description := episode.Description
		if description == "" {
			description = title
		}

		_, err = s.sermons.Create(ctx, adminsermons.CreateRequest{
			ExternalID:   externalID,
			Type:         "audio",
			Code:         code,
			Title:        title,
			Speaker:      speaker,
			SermonDate:   published.In(eastAfrica).Format("2006-01-02"),
			PublishedAt:  published.UTC().Format(time.RFC3339),
			ThumbnailURL: episode.ImageURL,
			Duration:     episode.Duration,
			Description:  description,
			MediaURL:     episode.AudioURL,
			Source:       adminsermons.SourcePodcast,
			Status:       adminsermons.StatusReady,
		})
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("episode %q: %v", episode.Title, err))
			continue
		}
		report.PodcastAdded++
	}

	return nil
}
