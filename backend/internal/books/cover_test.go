package books

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	"os/exec"
	"testing"
)

func fixturePDF() []byte {
	var b bytes.Buffer
	b.WriteString("%PDF-1.4\n")
	offsets := []int{0}
	objects := []string{"<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 4 0 R >>", "<< /Length 28 >>\nstream\n0.8 0.6 0.1 rg 0 0 300 400 re f\nendstream"}
	for i, obj := range objects {
		offsets = append(offsets, b.Len())
		fmt.Fprintf(&b, "%d 0 obj\n%s\nendobj\n", i+1, obj)
	}
	start := b.Len()
	fmt.Fprintf(&b, "xref\n0 5\n0000000000 65535 f \n")
	for _, o := range offsets[1:] {
		fmt.Fprintf(&b, "%010d 00000 n \n", o)
	}
	fmt.Fprintf(&b, "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", start)
	return b.Bytes()
}
func TestFirstPageCover(t *testing.T) {
	if _, e := exec.LookPath("pdftoppm"); e != nil {
		t.Skip("install poppler-utils")
	}
	cover, err := firstPageCover(context.Background(), fixturePDF())
	if err != nil {
		t.Fatal(err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(cover))
	if err != nil || cfg.Height != 1000 || cfg.Width != 750 {
		t.Fatalf("cover proportions: %+v %v", cfg, err)
	}
	if _, err = firstPageCover(context.Background(), []byte("%PDF broken")); err == nil {
		t.Fatal("corrupt PDF accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = firstPageCover(ctx, fixturePDF()); err == nil {
		t.Fatal("cancelled extraction continued")
	}
}
func TestCoverValidation(t *testing.T) {
	h := Handler{publicBase: "https://media.ministry.test"}
	for _, v := range []string{"https://evil.test/cover.jpg", "https://media.ministry.test/books/files/private.bin", "https://media.ministry.test/uploads/../books/files/private.bin"} {
		if h.validCoverURL(v) {
			t.Fatal("invalid cover accepted", v)
		}
	}
	if !h.validCoverURL("https://media.ministry.test/books/covers/image.jpg") {
		t.Fatal("generated cover rejected")
	}
}
