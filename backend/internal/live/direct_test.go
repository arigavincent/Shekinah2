package live

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

func TestSegmentValidation(t *testing.T) {
	good := directSegment{Sequence: 0, Size: 376, SHA256: fmt.Sprintf("%064x", 1), Duration: 3}
	if !validSegment(good, "mpegts") {
		t.Fatal("valid segment rejected")
	}
	for _, bad := range []directSegment{{Sequence: -1, Size: 376, SHA256: good.SHA256, Duration: 3}, {Sequence: 0, Size: segmentLimit + 1, SHA256: good.SHA256, Duration: 3}, {Sequence: 0, Size: 376, SHA256: "not-a-hash", Duration: 3}, {Sequence: 0, Size: 376, SHA256: good.SHA256, Duration: 0}} {
		if validSegment(bad, "mpegts") {
			t.Fatal("invalid segment accepted")
		}
	}
	if validMediaPrefix([]byte("not a movie"), "mpegts", 0) {
		t.Fatal("invalid media accepted")
	}
}

func TestBrowserInitializationWithoutFileTypeBox(t *testing.T) {
	// Chrome can begin a recording with moov directly. The init fragment still
	// contains the track metadata and decodes as H264/Opus with its media data.
	init := []byte{0, 0, 4, 0, 'm', 'o', 'o', 'v'}
	if !validMediaPrefix(init, "fmp4", -1) {
		t.Fatal("Chrome initialization without ftyp was rejected")
	}
	if validMediaPrefix(init, "fmp4", 0) {
		t.Fatal("initialization was accepted as a media fragment")
	}
}

// Explicit opt-in acceptance: creates and deletes one tiny object, never touches
// ministry data or account bucket policies. No secrets/URLs are printed.
func TestDirectR2ConditionalChecksumAcceptance(t *testing.T) {
	if os.Getenv("TEST_REAL_R2") != "1" {
		t.Skip("opt-in real R2 acceptance")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()
	store, err := newArchiveStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	key := "qa-direct-live/" + randomKey() + ".ts"
	defer store.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key)})
	body := make([]byte, 376)
	body[0] = 0x47
	body[188] = 0x47
	sum := sha256.Sum256(body)
	checksum := base64.StdEncoding.EncodeToString(sum[:])
	signed, err := s3.NewPresignClient(store.client).PresignPutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key), ContentLength: aws.Int64(int64(len(body))), ChecksumSHA256: aws.String(checksum), IfNoneMatch: aws.String("*")}, func(o *s3.PresignOptions) { o.Expires = time.Minute })
	if err != nil {
		t.Fatal("presign failed")
	}
	for i := 0; i < 2; i++ {
		req, _ := http.NewRequestWithContext(ctx, "PUT", signed.URL, bytes.NewReader(body))
		for k, v := range signed.SignedHeader {
			req.Header[k] = v
		}
		req.Header.Set("If-None-Match", "*")
		resp, e := http.DefaultClient.Do(req)
		if e != nil {
			t.Fatal("signed upload request failed")
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		if i == 0 && resp.StatusCode != 200 {
			t.Fatalf("conditional checksum upload returned %d", resp.StatusCode)
		}
		if i == 1 && resp.StatusCode != 412 {
			t.Fatalf("overwrite prevention returned %d", resp.StatusCode)
		}
	}
	obj, err := store.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key), Range: aws.String("bytes=0-65535")})
	if err != nil {
		t.Fatal("read acknowledgment failed")
	}
	defer obj.Body.Close()
	data, _ := io.ReadAll(obj.Body)
	if !bytes.Equal(data, body) {
		t.Fatal("uploaded data changed")
	}
	t.Log("Real R2 signed PUT, SHA256 integrity and immutable retry passed; exact QA object deleted")
}
