package uploads

import "bytes"

// Check container signatures before any staged file can become publicly served.
func validMagic(contentType string, b []byte) bool {
	mp4 := len(b) >= 12 && bytes.Equal(b[4:8], []byte("ftyp"))
	riff := len(b) >= 12 && bytes.Equal(b[:4], []byte("RIFF"))
	switch contentType {
	case "application/pdf":
		return bytes.HasPrefix(b, []byte("%PDF-"))
	case "image/jpeg":
		return bytes.HasPrefix(b, []byte{0xff, 0xd8, 0xff})
	case "image/png":
		return bytes.HasPrefix(b, []byte("\x89PNG\r\n\x1a\n"))
	case "image/webp":
		return riff && bytes.Equal(b[8:12], []byte("WEBP"))
	case "video/mp4", "audio/mp4":
		return mp4
	case "video/quicktime":
		return mp4 || len(b) >= 8 && (bytes.Equal(b[4:8], []byte("moov")) || bytes.Equal(b[4:8], []byte("mdat")) || bytes.Equal(b[4:8], []byte("wide")))
	case "video/webm":
		return bytes.HasPrefix(b, []byte{0x1a, 0x45, 0xdf, 0xa3})
	case "audio/mpeg":
		return bytes.HasPrefix(b, []byte("ID3")) || len(b) > 1 && b[0] == 0xff && b[1]&0xe0 == 0xe0
	case "audio/aac":
		return len(b) > 1 && b[0] == 0xff && b[1]&0xf6 == 0xf0
	case "audio/wav":
		return riff && bytes.Equal(b[8:12], []byte("WAVE"))
	case "audio/ogg":
		return bytes.HasPrefix(b, []byte("OggS"))
	}
	return false
}
