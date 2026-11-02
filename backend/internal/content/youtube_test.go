package content

import "testing"

func TestYouTubeID(t *testing.T) {
	for in, want := range map[string]string{
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s":      "dQw4w9WgXcQ",
		"https://youtu.be/dQw4w9WgXcQ?si=abc":                    "dQw4w9WgXcQ",
		"https://m.youtube.com/watch?v=dQw4w9WgXcQ":              "dQw4w9WgXcQ",
		"https://www.youtube.com/live/dQw4w9WgXcQ?feature=share": "dQw4w9WgXcQ",
		"https://youtube.com/shorts/dQw4w9WgXcQ":                 "dQw4w9WgXcQ",
		"https://www.youtube.com/embed/dQw4w9WgXcQ":              "dQw4w9WgXcQ",
		"https://example.com/watch?v=dQw4w9WgXcQ":                "",
		"https://pub-x.r2.dev/sermons/a.mp4":                     "",
		"https://www.youtube.com/@church":                        "",
	} {
		if got := YouTubeID(in); got != want {
			t.Errorf("%s: got %q want %q", in, got, want)
		}
	}
}
