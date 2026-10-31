package live

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"testing"
)

func TestDecryptSegmentReversesPublisherEncryption(t *testing.T) {
	t.Setenv("LIBRARY_ENCRYPTION_KEY", "fixture-root")
	plain := bytes.Repeat([]byte("video-bytes"), 37)
	pad := aes.BlockSize - len(plain)%aes.BlockSize
	padded := append(append([]byte{}, plain...), bytes.Repeat([]byte{byte(pad)}, pad)...)
	block, _ := aes.NewCipher(directKey("live-abc123def456"))
	sealed := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, directIV(7)).CryptBlocks(sealed, padded)
	got, err := decryptSegment(sealed, "live-abc123def456", 7)
	if err != nil || !bytes.Equal(got, plain) {
		t.Fatalf("decrypt mismatch: %v", err)
	}
	// A wrong sequence uses the wrong IV, which garbles the first block.
	if wrong, _ := decryptSegment(sealed, "live-abc123def456", 8); bytes.Equal(wrong[:aes.BlockSize], plain[:aes.BlockSize]) {
		t.Fatal("wrong sequence IV should not reproduce the media")
	}
}
