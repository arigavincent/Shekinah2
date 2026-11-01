package live

// Replay covers (see cover.go) and segment decryption.
import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// thumbnailNext draws the branded cover for the next ready replay without one.
func (h *Handler) thumbnailNext(ctx context.Context) error {
	for range 5 {
		var id string
		err := h.db.QueryRow(ctx, `SELECT l.id FROM live_sessions l JOIN live_archives a ON a.session_id=l.id
			WHERE a.status='ready' AND a.thumbnail_url='' AND a.thumbnail_attempts<3
			ORDER BY l.started_at DESC NULLS LAST LIMIT 1`).Scan(&id)
		if err != nil {
			return nil // nothing waiting
		}
		if err := h.drawCover(ctx, id); err != nil {
			_, _ = h.db.Exec(ctx, `UPDATE live_archives SET thumbnail_attempts=thumbnail_attempts+1 WHERE session_id=$1`, id)
			return fmt.Errorf("cover %s: %w", id, err)
		}
	}
	return nil
}

// drawCover renders and stores a replay's branded cover (unless an admin set
// their own), removing the previous automatic one.
func (h *Handler) drawCover(ctx context.Context, id string) error {
	var title, old string
	var custom bool
	var started *time.Time
	if err := h.db.QueryRow(ctx, `SELECT l.title, l.started_at, a.thumbnail_url, a.thumbnail_custom FROM live_sessions l JOIN live_archives a ON a.session_id=l.id WHERE l.id=$1`, id).Scan(&title, &started, &old, &custom); err != nil {
		return err
	}
	if custom {
		return nil
	}
	base := strings.TrimRight(env("R2_SERMONS_PUBLIC_BASE_URL", env("R2_PUBLIC_BASE_URL", "")), "/")
	if base == "" {
		return errors.New("no public media address configured")
	}
	store, err := newArchiveStore(ctx)
	if err != nil {
		return err
	}
	date := time.Time{}
	if started != nil {
		date = *started
	}
	jpeg, err := RenderReplayCover(id, title, date)
	if err != nil {
		return err
	}
	suffix := make([]byte, 6)
	_, _ = rand.Read(suffix)
	key := fmt.Sprintf("replay-thumbs/%s-%s.jpg", id, hex.EncodeToString(suffix))
	_, err = store.client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(key), Body: bytes.NewReader(jpeg),
		ContentType: aws.String("image/jpeg"), CacheControl: aws.String("public, max-age=31536000, immutable")})
	if err != nil {
		return err
	}
	if _, err = h.db.Exec(ctx, `UPDATE live_archives SET thumbnail_url=$2 WHERE session_id=$1 AND NOT thumbnail_custom`, id, base+"/"+key); err != nil {
		return err
	}
	h.removeOwnCover(ctx, store, base, old)
	return nil
}

// removeOwnCover deletes a cover this server drew earlier (never outside files).
func (h *Handler) removeOwnCover(ctx context.Context, store *archiveStore, base, url string) {
	if oldKey, ok := strings.CutPrefix(url, base+"/"); ok && strings.HasPrefix(oldKey, "replay-thumbs/") {
		_, _ = store.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(store.bucket), Key: aws.String(oldKey)})
	}
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
