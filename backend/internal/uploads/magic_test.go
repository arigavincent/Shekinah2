package uploads

import "testing"

func TestRejectDisguisedUploads(t *testing.T) {
	cases := []struct {
		mime string
		data []byte
	}{{"application/pdf", []byte("%PDF-1.4\n")}, {"image/png", []byte("\x89PNG\r\n\x1a\n")}, {"image/jpeg", []byte{255, 216, 255}}, {"image/webp", []byte("RIFF0000WEBP")}, {"video/mp4", []byte("0000ftypisom")}, {"audio/mpeg", []byte("ID3audio")}, {"audio/wav", []byte("RIFF0000WAVE")}, {"audio/ogg", []byte("OggS")}}
	for _, c := range cases {
		if !validMagic(c.mime, c.data) {
			t.Errorf("valid %s rejected", c.mime)
		}
		if validMagic(c.mime, []byte("<html>disguised content</html>")) {
			t.Errorf("HTML accepted as %s", c.mime)
		}
		if validMagic(c.mime, nil) {
			t.Errorf("empty file accepted as %s", c.mime)
		}
	}
}
