package sermonmedia

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func testPresigner() R2Presigner {
	return R2Presigner{
		endpoint:      "https://acct.r2.cloudflarestorage.com",
		bucket:        "shekinah-sermons",
		publicBaseURL: "https://pub-example.r2.dev",
		accessKeyID:   "key",
		secretKey:     "secret",
	}
}

func TestPresignVideoUpload(t *testing.T) {
	upload, err := testPresigner().Presign(context.Background(), DirectUploadRequest{Kind: "video", FileName: "Sunday Service.MP4", SizeBytes: 900_000_000})
	if err != nil {
		t.Fatal(err)
	}
	if upload.ContentType != "video/mp4" {
		t.Fatalf("content type = %q", upload.ContentType)
	}
	if !strings.HasPrefix(upload.PublicURL, "https://pub-example.r2.dev/sermons/video/") || !strings.HasSuffix(upload.PublicURL, ".mp4") {
		t.Fatalf("public url = %q", upload.PublicURL)
	}
	if !strings.Contains(upload.UploadURL, "X-Amz-Signature=") || !strings.Contains(upload.UploadURL, "/shekinah-sermons/") {
		t.Fatalf("upload url not presigned for the bucket: %q", upload.UploadURL)
	}
}

func TestPresignRejectsBadInput(t *testing.T) {
	cases := []DirectUploadRequest{
		{Kind: "video", FileName: "notes.pdf", SizeBytes: 10},
		{Kind: "image", FileName: "a.jpg", SizeBytes: 10},
		{Kind: "audio", FileName: "a.mp3", SizeBytes: 0},
		{Kind: "video", FileName: "a.mp4", SizeBytes: MaxDirectUploadBytes + 1},
	}
	for _, req := range cases {
		if _, err := testPresigner().Presign(context.Background(), req); !errors.Is(err, ErrInvalidUpload) {
			t.Errorf("%+v: want ErrInvalidUpload, got %v", req, err)
		}
	}
}

func TestPresignNotConfigured(t *testing.T) {
	if _, err := (R2Presigner{}).Presign(context.Background(), DirectUploadRequest{Kind: "video", FileName: "a.mp4", SizeBytes: 1}); !errors.Is(err, ErrR2NotConfigured) {
		t.Fatalf("want ErrR2NotConfigured, got %v", err)
	}
}
