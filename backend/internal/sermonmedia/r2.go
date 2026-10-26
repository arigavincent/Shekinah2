package sermonmedia

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var ErrR2NotConfigured = errors.New("r2 storage is not configured")

// MaxDirectUploadBytes is R2's single-request PUT limit.
const MaxDirectUploadBytes int64 = 5 * 1024 * 1024 * 1024

var directUploadTypes = map[string]map[string]string{
	"video": {".mp4": "video/mp4", ".m4v": "video/x-m4v", ".mov": "video/quicktime", ".webm": "video/webm"},
	"audio": {".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg"},
	"image": {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"},
}

// R2Presigner hands out short-lived PUT URLs so the admin dashboard sends
// sermon files straight to R2 instead of through this server.
// R2_SERMONS_BUCKET / R2_SERMONS_PUBLIC_BASE_URL override the shared bucket.
type R2Presigner struct {
	endpoint      string
	bucket        string
	publicBaseURL string
	accessKeyID   string
	secretKey     string
}

func NewR2PresignerFromEnv() R2Presigner {
	endpoint := strings.TrimRight(os.Getenv("R2_ENDPOINT"), "/")
	if endpoint == "" && os.Getenv("R2_ACCOUNT_ID") != "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", strings.TrimSpace(os.Getenv("R2_ACCOUNT_ID")))
	}

	bucket := firstNonEmpty(os.Getenv("R2_SERMONS_BUCKET"), os.Getenv("R2_BUCKET"))
	publicBase := firstNonEmpty(os.Getenv("R2_SERMONS_PUBLIC_BASE_URL"), os.Getenv("R2_PUBLIC_BASE_URL"))

	return R2Presigner{
		endpoint:      endpoint,
		bucket:        strings.TrimSpace(bucket),
		publicBaseURL: strings.TrimRight(strings.TrimSpace(publicBase), "/"),
		accessKeyID:   strings.TrimSpace(os.Getenv("R2_ACCESS_KEY_ID")),
		secretKey:     strings.TrimSpace(os.Getenv("R2_SECRET_ACCESS_KEY")),
	}
}

func (p R2Presigner) Configured() bool {
	return p.endpoint != "" && p.bucket != "" && p.publicBaseURL != "" && p.accessKeyID != "" && p.secretKey != ""
}

type DirectUploadRequest struct {
	Kind      string `json:"kind"`
	FileName  string `json:"fileName"`
	SizeBytes int64  `json:"sizeBytes"`
}

type DirectUpload struct {
	UploadURL   string `json:"uploadUrl"`
	PublicURL   string `json:"publicUrl"`
	ObjectKey   string `json:"objectKey"`
	ContentType string `json:"contentType"`
	ExpiresAt   string `json:"expiresAt"`
}

var ErrInvalidUpload = errors.New("invalid upload")

func (p R2Presigner) Presign(ctx context.Context, req DirectUploadRequest) (DirectUpload, error) {
	if !p.Configured() {
		return DirectUpload{}, ErrR2NotConfigured
	}

	kind := strings.ToLower(strings.TrimSpace(req.Kind))
	types, ok := directUploadTypes[kind]
	if !ok {
		return DirectUpload{}, fmt.Errorf("%w: kind must be video, audio or image", ErrInvalidUpload)
	}

	ext := strings.ToLower(path.Ext(strings.TrimSpace(req.FileName)))
	contentType, ok := types[ext]
	if !ok {
		return DirectUpload{}, fmt.Errorf("%w: %s files must be one of %s", ErrInvalidUpload, kind, allowedExtensions(types))
	}

	if req.SizeBytes <= 0 || req.SizeBytes > MaxDirectUploadBytes {
		return DirectUpload{}, fmt.Errorf("%w: file must be between 1 byte and 5 GB", ErrInvalidUpload)
	}

	suffix := make([]byte, 8)
	if _, err := rand.Read(suffix); err != nil {
		return DirectUpload{}, fmt.Errorf("random key: %w", err)
	}
	objectKey := fmt.Sprintf("sermons/%s/%s/%s%s", kind, time.Now().UTC().Format("2006/01"), hex.EncodeToString(suffix), ext)

	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion("auto"),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(p.accessKeyID, p.secretKey, "")),
	)
	if err != nil {
		return DirectUpload{}, fmt.Errorf("configure r2: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(p.endpoint)
		options.UsePathStyle = true
	})

	const validFor = 2 * time.Hour
	signed, err := s3.NewPresignClient(client).PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(p.bucket),
		Key:           aws.String(objectKey),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(req.SizeBytes),
	}, s3.WithPresignExpires(validFor))
	if err != nil {
		return DirectUpload{}, fmt.Errorf("presign r2 upload: %w", err)
	}

	return DirectUpload{
		UploadURL:   signed.URL,
		PublicURL:   p.publicBaseURL + "/" + objectKey,
		ObjectKey:   objectKey,
		ContentType: contentType,
		ExpiresAt:   time.Now().Add(validFor).UTC().Format(time.RFC3339),
	}, nil
}

func allowedExtensions(types map[string]string) string {
	list := make([]string, 0, len(types))
	for ext := range types {
		list = append(list, ext)
	}
	return strings.Join(list, ", ")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
