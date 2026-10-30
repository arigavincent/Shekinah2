package database

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"testing"
)

func TestBootstrapAuthentication(t *testing.T) {
	root := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 32))
	aead, e := bootstrapAEAD(root)
	if e != nil {
		t.Fatal(e)
	}
	nonce := bytes.Repeat([]byte{3}, aead.NonceSize())
	plain := []byte("SELECT 1;")
	blob := aead.Seal(append([]byte{}, nonce...), nonce, plain, []byte(bootstrapAAD))
	sum := sha256.Sum256(blob)
	out, e := OpenBootstrap(blob, root, hex.EncodeToString(sum[:]))
	if e != nil || !bytes.Equal(out, plain) {
		t.Fatal("valid authenticated bootstrap failed")
	}
	blob[len(blob)-1] ^= 1
	sum = sha256.Sum256(blob)
	if _, e = OpenBootstrap(blob, root, hex.EncodeToString(sum[:])); e == nil {
		t.Fatal("tampered backup accepted")
	}
	if _, e = OpenBootstrap(blob, root, "incorrect"); e == nil {
		t.Fatal("wrong object pin accepted")
	}
	if _, e = bootstrapAEAD("weak"); e == nil {
		t.Fatal("weak encryption root accepted")
	}
}
