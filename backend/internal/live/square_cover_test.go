package live

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSquareAudioCovers(t *testing.T) {
	cases := []struct{ title, speaker, label, main, by string }{
		{"SHEKINAH DAY 085 | Questions and Answers by Apostle Joseph Mash", "SHEKINAH SONS MOVEMENT", "SHEKINAH DAY 085", "Questions and Answers", "Apostle Joseph Mash"},
		{"SUNDAY SERVICE 086 : KERUGOYA GILRS MINISTRATION | The blessing By Apostle  Joseph Mash", "", "SUNDAY SERVICE 086", "The blessing", "Apostle Joseph Mash"},
		{"SHEKINAH DAY 083 : Marriages part 3 by Apostle Joseph Mash", "", "SHEKINAH DAY 083", "Marriages part 3", "Apostle Joseph Mash"},
		{"Mens Talk", "SHEKINAH SONS MOVEMENT", "", "Mens Talk", "Shekinah Sons Global"},
	}
	out := os.Getenv("COVER_OUT")
	for i, c := range cases {
		l, m, b := AudioCoverText(c.title, c.speaker)
		if l != c.label || m != c.main || b != c.by {
			t.Errorf("%q → %q / %q / %q", c.title, l, m, b)
		}
		img, err := RenderSquareCover(c.title, l, m, b)
		if err != nil || len(img) < 10000 {
			t.Fatalf("render: %v", err)
		}
		if out != "" {
			_ = os.WriteFile(filepath.Join(out, "sq"+string(rune('0'+i))+".jpg"), img, 0o644)
		}
	}
}
