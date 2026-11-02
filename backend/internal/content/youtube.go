package content

import (
	"net/url"
	"regexp"
	"strings"
)

var youtubeIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

// YouTubeID returns the video id when a sermon's media link is a YouTube
// video (watch, youtu.be, shorts, live or embed links), or "".
func YouTubeID(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" {
		return ""
	}
	host := strings.TrimPrefix(strings.ToLower(u.Host), "www.")
	host = strings.TrimPrefix(host, "m.")
	var id string
	switch host {
	case "youtu.be":
		id = strings.Trim(u.Path, "/")
	case "youtube.com", "music.youtube.com", "youtube-nocookie.com":
		if u.Path == "/watch" {
			id = u.Query().Get("v")
		} else {
			parts := strings.Split(strings.Trim(u.Path, "/"), "/")
			if len(parts) == 2 && (parts[0] == "shorts" || parts[0] == "live" || parts[0] == "embed" || parts[0] == "v") {
				id = parts[1]
			}
		}
	}
	if youtubeIDPattern.MatchString(id) {
		return id
	}
	return ""
}
