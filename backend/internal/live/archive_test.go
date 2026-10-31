package live

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"
)

func TestArchiveEncryptionRejectsTampering(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "source")
	enc := filepath.Join(dir, "encrypted")
	out := filepath.Join(dir, "output")
	plain := bytes.Repeat([]byte("private paid replay"), 10000)
	key := sha256.Sum256([]byte("fixture"))
	if err := os.WriteFile(src, plain, 0600); err != nil {
		t.Fatal(err)
	}
	if err := sealArchive(src, enc, key); err != nil {
		t.Fatal(err)
	}
	sealed, _ := os.ReadFile(enc)
	if bytes.Contains(sealed, []byte("private paid replay")) {
		t.Fatal("recording was not encrypted")
	}
	if err := openArchive(enc, out, key); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(out)
	if !bytes.Equal(got, plain) {
		t.Fatal("round trip changed video")
	}
	for _, offset := range []int{0, 20, len(sealed) - 1} {
		altered := bytes.Clone(sealed)
		altered[offset] ^= 1
		_ = os.WriteFile(enc, altered, 0600)
		_ = os.Remove(out)
		if openArchive(enc, out, key) == nil {
			t.Fatalf("accepted tamper at %d", offset)
		}
		if _, err := os.Stat(out); err == nil {
			t.Fatal("exposed unverified plaintext")
		}
	}
}

func TestRecordingFinalizesUploadsAndRestoresEncryptedR2(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg required for recording integration")
	}
	root := t.TempDir()
	t.Setenv("LIVE_RECORDINGS_DIR", root)
	folder := filepath.Join(root, "live-fixture", path)
	if err := os.MkdirAll(folder, 0700); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=black:s=160x120:r=10", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.5", "-c:v", "libx264", "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov", filepath.Join(folder, "001.mp4"))
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("recording fixture: %v %s", err, out)
	}
	var stored []byte
	r2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "PUT":
			stored, _ = io.ReadAll(r.Body)
			w.WriteHeader(200)
		case "GET":
			w.Header().Set("Content-Length", strconv.Itoa(len(stored)))
			_, _ = w.Write(stored)
		default:
			w.WriteHeader(405)
		}
	}))
	defer r2.Close()
	for k, v := range map[string]string{"R2_ENDPOINT": r2.URL, "R2_BUCKET": "fixtures", "R2_SERMONS_BUCKET": "", "R2_ACCESS_KEY_ID": "fixture", "R2_SECRET_ACCESS_KEY": "fixture", "LIBRARY_ENCRYPTION_KEY": "fixture-encryption-key"} {
		t.Setenv(k, v)
	}
	h := &Handler{}
	size, key, err := h.archive(context.Background(), "live-fixture")
	if err != nil {
		t.Fatal(err)
	}
	if size <= 0 || len(stored) <= int(size) {
		t.Fatal("recording was not encrypted and uploaded")
	}
	plain := filepath.Join(archiveCache(), "live-fixture.mp4")
	expected, err := os.ReadFile(plain)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(stored, expected[:min(32, len(expected))]) {
		t.Fatal("R2 contains plaintext video")
	}
	if err = os.Remove(plain); err != nil {
		t.Fatal(err)
	}
	if err = h.restoreReplay(context.Background(), plain, key); err != nil {
		t.Fatal(err)
	}
	restored, _ := os.ReadFile(plain)
	if !bytes.Equal(expected, restored) {
		t.Fatal("R2 restore corrupted the recording")
	}
}

func TestMultipartArchiveCompletesAndAbortsFailures(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(fmt.Sprint(fail), func(t *testing.T) {
			var received []byte
			var aborted, completed bool
			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch {
				case r.Method == "POST" && r.URL.Query().Has("uploads"):
					w.Header().Set("Content-Type", "application/xml")
					_, _ = io.WriteString(w, `<InitiateMultipartUploadResult><UploadId>fixture</UploadId></InitiateMultipartUploadResult>`)
				case r.Method == "PUT":
					if fail {
						w.WriteHeader(400)
						return
					}
					data, _ := io.ReadAll(r.Body)
					received = append(received, data...)
					w.Header().Set("ETag", `"part"`)
					w.WriteHeader(200)
				case r.Method == "POST":
					completed = true
					w.Header().Set("Content-Type", "application/xml")
					_, _ = io.WriteString(w, `<CompleteMultipartUploadResult><ETag>done</ETag></CompleteMultipartUploadResult>`)
				case r.Method == "DELETE":
					aborted = true
					w.WriteHeader(204)
				}
			}))
			defer api.Close()
			for k, v := range map[string]string{"R2_ENDPOINT": api.URL, "R2_BUCKET": "fixtures", "R2_SERMONS_BUCKET": "", "R2_ACCESS_KEY_ID": "fixture", "R2_SECRET_ACCESS_KEY": "fixture", "LIBRARY_ENCRYPTION_KEY": "fixture"} {
				t.Setenv(k, v)
			}
			store, err := newArchiveStore(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			payload := bytes.Repeat([]byte("encrypted recording"), 100)
			err = store.multipart(context.Background(), bytes.NewReader(payload), "fixture", int64(len(payload)), 400)
			if fail {
				if err == nil || !aborted || completed {
					t.Fatal("failed multipart upload was not aborted")
				}
			} else if err != nil || !completed || aborted || !bytes.Equal(payload, received) {
				t.Fatalf("multipart changed video or failed: %v", err)
			}
		})
	}
}
