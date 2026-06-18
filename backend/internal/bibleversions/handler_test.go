package bibleversions

import (
	"os"
	"testing"
)

func TestParseCatalogFromCSVSnapshot(t *testing.T) {
	body, err := os.ReadFile("catalog/translations.csv")
	if err != nil {
		t.Fatalf("read catalog snapshot: %v", err)
	}

	items := parseCatalogFromCSV(string(body))
	if len(items) < 1000 {
		t.Fatalf("expected large parsed catalog, got %d items", len(items))
	}

	var foundKikuyu bool
	var foundLuo bool
	var foundSwahili bool

	for _, item := range items {
		switch item.ID {
		case "kik":
			foundKikuyu = true
		case "luo":
			foundLuo = true
		case "swhonen":
			foundSwahili = true
		}
	}

	if !foundKikuyu {
		t.Fatal("expected kik entry in parsed catalog")
	}
	if !foundLuo {
		t.Fatal("expected luo entry in parsed catalog")
	}
	if !foundSwahili {
		t.Fatal("expected swhonen entry in parsed catalog")
	}
}

func TestCatalogSnapshotKikuyuDownloadURL(t *testing.T) {
	body, err := os.ReadFile("catalog/translations.csv")
	if err != nil {
		t.Fatalf("read catalog snapshot: %v", err)
	}

	items := parseCatalogFromCSV(string(body))

	for _, item := range items {
		if item.ID == "kik" {
			if item.DownloadURL != "https://ebible.org/Scriptures/kik_vpl.zip" {
				t.Fatalf("unexpected Kikuyu download URL: %s", item.DownloadURL)
			}
			if item.FileType != "vpl-text" {
				t.Fatalf("unexpected Kikuyu file type: %s", item.FileType)
			}
			return
		}
	}

	t.Fatal("expected kik entry in parsed catalog")
}
