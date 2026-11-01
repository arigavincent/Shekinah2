package live

import (
	"os"
	"testing"
	"time"
)

func TestRenderReplayCover(t *testing.T) {
	for i, title := range []string{"Sunday Service", "The Glory of the Latter House Shall Be Greater Than the Former", ""} {
		b, err := RenderReplayCover("live-00000000000"+string(rune('a'+i)), title, time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC))
		if err != nil || len(b) < 10000 {
			t.Fatalf("cover %d: %v (%d bytes)", i, err, len(b))
		}
		if dir := os.Getenv("COVER_OUT"); dir != "" {
			_ = os.WriteFile(dir+"/cover"+string(rune('0'+i))+".jpg", b, 0o644)
		}
	}
}
