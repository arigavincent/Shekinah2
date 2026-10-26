package sermons

import "testing"

func TestNormalizeCode(t *testing.T) {
	cases := map[string]string{
		"":       "",
		"S.14":   "S.14",
		"s14":    "S.14",
		"s 14":   "S.14",
		"P.582":  "P.582",
		"p..582": "P.582",
		"KO 7":   "KO.7",
		"EASTER": "EASTER",
	}

	for input, want := range cases {
		if got := normalizeCode(input); got != want {
			t.Errorf("normalizeCode(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestValidateCommandAllowsProcessingStreamWithoutMedia(t *testing.T) {
	base := Command{ID: "ser-1", ExternalID: "ser-1", Type: "video", Title: "T", Speaker: "S", Description: "D", Source: SourceCloudflareStream, StreamUID: "abc", Status: StatusProcessing}
	base.PublishedAt = base.PublishedAt.AddDate(2026, 0, 0)

	if err := validateCommand(base); err != nil {
		t.Fatalf("processing stream upload should be valid without media: %v", err)
	}

	ready := base
	ready.Status = StatusReady
	if err := validateCommand(ready); err == nil {
		t.Fatal("ready stream sermon without media URL should be invalid")
	}

	missingUID := base
	missingUID.StreamUID = ""
	if err := validateCommand(missingUID); err == nil {
		t.Fatal("stream-backed sermon without stream uid should be invalid")
	}
}
