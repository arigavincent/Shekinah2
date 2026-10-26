package sermonmedia

import "testing"

const sampleFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <itunes:author>Shekinah Sons Global</itunes:author>
    <itunes:image href="https://example.com/show.jpg"/>
    <item>
      <title>S.14 Why Jesus Christ Came And Died</title>
      <description><![CDATA[<p>A teaching on the <b>cross</b>.</p>]]></description>
      <guid isPermaLink="false">ep-14</guid>
      <pubDate>Mon, 01 Jun 2026 07:00:00 GMT</pubDate>
      <itunes:duration>3725</itunes:duration>
      <enclosure url="https://example.com/ep14.mp3" type="audio/mpeg" length="1"/>
    </item>
    <item>
      <title>Video only</title>
      <guid>ep-15</guid>
      <enclosure url="https://example.com/ep15.mp4" type="video/mp4"/>
    </item>
  </channel>
</rss>`

func TestParsePodcastFeed(t *testing.T) {
	episodes, err := ParsePodcastFeed([]byte(sampleFeed))
	if err != nil {
		t.Fatal(err)
	}
	if len(episodes) != 1 {
		t.Fatalf("want 1 audio episode, got %d", len(episodes))
	}

	ep := episodes[0]
	if ep.GUID != "ep-14" || ep.AudioURL != "https://example.com/ep14.mp3" {
		t.Fatalf("unexpected episode: %+v", ep)
	}
	if ep.Description != "A teaching on the cross ." && ep.Description != "A teaching on the cross." {
		t.Fatalf("description not plain text: %q", ep.Description)
	}
	if ep.Duration != "1:02:05" {
		t.Fatalf("duration = %q", ep.Duration)
	}
	if ep.ImageURL != "https://example.com/show.jpg" || ep.Author != "Shekinah Sons Global" {
		t.Fatalf("channel fallbacks not applied: %+v", ep)
	}
	if ep.PublishedAt.IsZero() {
		t.Fatal("pubDate not parsed")
	}
}

func TestSplitEpisodeTitle(t *testing.T) {
	cases := []struct{ in, code, title string }{
		{"S.14 Why Jesus Came", "S.14", "Why Jesus Came"},
		{"P582 - The Blueprint", "P582", "The Blueprint"},
		{"Sunday Service", "", "Sunday Service"},
	}
	for _, c := range cases {
		code, title := splitEpisodeTitle(c.in)
		if code != c.code || title != c.title {
			t.Errorf("splitEpisodeTitle(%q) = %q, %q", c.in, code, title)
		}
	}
}
