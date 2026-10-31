package live

// Replay thumbnails: a frame from about a third of the way into each direct
// recording, on a blurred fill so portrait phone video suits 16:9 cards.
import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func (h *Handler) thumbnailNext(ctx context.Context) error {
	var id, format string
	var last int
	err := h.db.QueryRow(ctx, `SELECT l.id,l.segment_format,(SELECT COALESCE(MAX(sequence),0) FROM live_segments s WHERE s.session_id=l.id AND s.ready)
		FROM live_sessions l JOIN live_archives a ON a.session_id=l.id
		WHERE l.transport='r2' AND a.status='ready' AND a.thumbnail_url='' AND a.thumbnail_attempts<3
		ORDER BY l.started_at DESC NULLS LAST LIMIT 1`).Scan(&id, &format, &last)
	if err != nil {
		return nil // nothing waiting
	}
	url, err := h.makeThumbnail(ctx, id, format, min(last/3, 30))
	if err != nil {
		_, _ = h.db.Exec(ctx, `UPDATE live_archives SET thumbnail_attempts=thumbnail_attempts+1 WHERE session_id=$1`, id)
		return fmt.Errorf("thumbnail %s: %w", id, err)
	}
	_, err = h.db.Exec(ctx, `UPDATE live_archives SET thumbnail_url=$2 WHERE session_id=$1`, id, url)
	return err
}

func (h *Handler) makeThumbnail(ctx context.Context, id, format string, sequence int) (string, error) {
	base := strings.TrimRight(env("R2_SERMONS_PUBLIC_BASE_URL", env("R2_PUBLIC_BASE_URL", "")), "/")
	if base == "" {
		return "", errors.New("no public media address configured")
	}
	store, err := newArchiveStore(ctx)
	if err != nil {
		return "", err
	}
	var media []byte
	sequences := []int{sequence}
	if format == "fmp4" {
		sequences = []int{-1, sequence}
	}
	for _, seq := range sequences {
		var key string
		if err := h.db.QueryRow(ctx, `SELECT object_key FROM live_segments WHERE session_id=$1 AND sequence=$2 AND ready`, id, seq).Scan(&key); err != nil {
			return "", fmt.Errorf("segment %d missing", seq)
		}
		obj, err := store.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key)})
		if err != nil {
			return "", err
		}
		sealed, err := io.ReadAll(io.LimitReader(obj.Body, segmentLimit+16))
		obj.Body.Close()
		if err != nil {
			return "", err
		}
		plain, err := decryptSegment(sealed, id, seq)
		if err != nil {
			return "", err
		}
		media = append(media, plain...)
	}
	dir, err := os.MkdirTemp("", "replay-thumb-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(dir)
	in, out := filepath.Join(dir, "in"), filepath.Join(dir, "thumb.jpg")
	if err := os.WriteFile(in, media, 0o600); err != nil {
		return "", err
	}
	run, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	cmd := exec.CommandContext(run, "ffmpeg", "-v", "error", "-y", "-i", in, "-frames:v", "1", "-filter_complex",
		"[0:v]split[a][b];[a]scale=960:540:force_original_aspect_ratio=increase,crop=960:540,boxblur=24:2[bg];[b]scale=-2:540[fg];[bg][fg]overlay=(W-w)/2:0",
		"-q:v", "4", out)
	if msg, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("ffmpeg: %v %s", err, bytes.TrimSpace(msg))
	}
	jpeg, err := os.ReadFile(out)
	if err != nil {
		return "", err
	}
	suffix := make([]byte, 6)
	_, _ = rand.Read(suffix)
	key := fmt.Sprintf("replay-thumbs/%s-%s.jpg", id, hex.EncodeToString(suffix))
	_, err = store.client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key), Body: bytes.NewReader(jpeg),
		ContentType: aws.String("image/jpeg"), CacheControl: aws.String("public, max-age=31536000, immutable")})
	if err != nil {
		return "", err
	}
	return base + "/" + key, nil
}

// decryptSegment reverses the publisher's AES-128-CBC (PKCS#7) encryption.
func decryptSegment(b []byte, id string, seq int) ([]byte, error) {
	if len(b) == 0 || len(b)%aes.BlockSize != 0 {
		return nil, errors.New("encrypted segment has an invalid size")
	}
	block, err := aes.NewCipher(directKey(id))
	if err != nil {
		return nil, err
	}
	out := make([]byte, len(b))
	cipher.NewCBCDecrypter(block, directIV(seq)).CryptBlocks(out, b)
	pad := int(out[len(out)-1])
	if pad == 0 || pad > aes.BlockSize || pad > len(out) || !bytes.Equal(out[len(out)-pad:], bytes.Repeat([]byte{byte(pad)}, pad)) {
		return nil, errors.New("segment could not be decrypted")
	}
	return out[:len(out)-pad], nil
}
