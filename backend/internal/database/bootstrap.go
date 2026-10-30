package database

// Bootstrap a new empty database from an explicitly configured, authenticated
// deployment backup. This is never exposed as an HTTP endpoint and never runs
// against a database containing application tables. It lets a free Render
// service restore its own private database without opening administrative ports.
import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"os"
	"strings"
	"time"
)

const bootstrapAAD = "shekinah-database-bootstrap-v1"

func bootstrapAEAD(root string) (cipher.AEAD, error) {
	decoded, e := base64.StdEncoding.DecodeString(root)
	if e != nil || len(decoded) != 32 {
		return nil, errors.New("invalid database bootstrap encryption root")
	}
	key := sha256.Sum256(append([]byte(bootstrapAAD+":"), decoded...))
	block, e := aes.NewCipher(key[:])
	if e != nil {
		return nil, e
	}
	return cipher.NewGCM(block)
}
func OpenBootstrap(blob []byte, root, expectedSHA string) ([]byte, error) {
	sum := sha256.Sum256(blob)
	if len(expectedSHA) != 64 || hex.EncodeToString(sum[:]) != expectedSHA {
		return nil, errors.New("database bootstrap checksum mismatch")
	}
	aead, e := bootstrapAEAD(root)
	if e != nil {
		return nil, e
	}
	if len(blob) < aead.NonceSize()+aead.Overhead() {
		return nil, errors.New("database bootstrap is truncated")
	}
	plain, e := aead.Open(nil, blob[:aead.NonceSize()], blob[aead.NonceSize():], []byte(bootstrapAAD))
	if e != nil {
		return nil, errors.New("database bootstrap authentication failed")
	}
	return plain, nil
}
func BootstrapFromR2(ctx context.Context, db *pgxpool.Pool) error {
	key := os.Getenv("BOOTSTRAP_DATABASE_KEY")
	if key == "" {
		return nil
	}
	if !strings.HasPrefix(key, "deployment-bootstrap/") {
		return errors.New("invalid database bootstrap object")
	}
	tx, e := db.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(73915003)`); e != nil {
		return e
	}
	var count int
	if e = tx.QueryRow(ctx, `SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'`).Scan(&count); e != nil {
		return e
	}
	if count != 0 {
		return nil
	} // Existing data is never replaced, dropped or reseeded.
	endpoint := strings.TrimRight(os.Getenv("R2_ENDPOINT"), "/")
	if endpoint == "" && os.Getenv("R2_ACCOUNT_ID") != "" {
		endpoint = "https://" + os.Getenv("R2_ACCOUNT_ID") + ".r2.cloudflarestorage.com"
	}
	bucket := os.Getenv("R2_SERMONS_BUCKET")
	if bucket == "" {
		bucket = os.Getenv("R2_BUCKET")
	}
	if endpoint == "" || bucket == "" {
		return errors.New("database bootstrap storage is not configured")
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	cfg, e := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion("auto"), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(os.Getenv("R2_ACCESS_KEY_ID"), os.Getenv("R2_SECRET_ACCESS_KEY"), "")))
	if e != nil {
		return errors.New("database bootstrap storage initialization failed")
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(endpoint); o.UsePathStyle = true })
	object, e := client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)})
	if e != nil {
		return errors.New("database bootstrap object unavailable")
	}
	defer object.Body.Close()
	const limit = 64 << 20
	blob, e := io.ReadAll(io.LimitReader(object.Body, limit+1))
	if e != nil || len(blob) > limit {
		return errors.New("database bootstrap exceeds its size limit")
	}
	plain, e := OpenBootstrap(blob, os.Getenv("LIBRARY_ENCRYPTION_KEY"), os.Getenv("BOOTSTRAP_DATABASE_SHA256"))
	if e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, string(plain)); e != nil {
		return fmt.Errorf("database bootstrap restore failed: %w", e)
	}
	// pg_dump sets search_path='' and other session settings. Reset them before
	// this connection returns to pgx's pool, otherwise the first migration/API
	// query can no longer find the restored public tables.
	if _, e = tx.Exec(ctx, "RESET ALL"); e != nil {
		return e
	}
	if e = tx.Commit(ctx); e != nil {
		return e
	}
	return nil
}
