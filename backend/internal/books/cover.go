package books

import (
	"bytes"
	"context"
	"errors"
	"image"
	_ "image/jpeg"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// Render only page one. Source PDFs never leave a private temporary directory.
// The output is bounded to 1000px on its longest side, with a hard deadline.
var coverSlots = make(chan struct{}, 2)

func firstPageCover(ctx context.Context, pdf []byte) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	select {
	case coverSlots <- struct{}{}:
		defer func() { <-coverSlots }()
	case <-ctx.Done():
		return nil, errors.New("cover generation is busy; retry or supply a cover image")
	}
	dir, err := os.MkdirTemp("", "shekinah-cover-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	source := filepath.Join(dir, "source.pdf")
	output := filepath.Join(dir, "cover")
	if err = os.WriteFile(source, pdf, 0600); err != nil {
		return nil, err
	}
	cmd := exec.CommandContext(ctx, "pdftoppm", "-f", "1", "-l", "1", "-singlefile", "-scale-to", "1000", "-jpeg", "-jpegopt", "quality=85", source, output)
	// Discard parser diagnostics, which can include document content.
	if err = cmd.Run(); err != nil {
		return nil, errors.New("could not extract PDF cover; choose a readable PDF or supply a cover image")
	}
	filename := output + ".jpg"
	stat, err := os.Stat(filename)
	if err != nil || stat.Size() > 10<<20 {
		return nil, errors.New("generated cover exceeds the image limit")
	}
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 1000 || config.Height > 1000 {
		return nil, errors.New("invalid generated cover")
	}
	return data, nil
}
func coverType(data []byte) string {
	switch ct := http.DetectContentType(data); ct {
	case "image/jpeg", "image/png", "image/webp":
		return ct
	}
	return ""
}
