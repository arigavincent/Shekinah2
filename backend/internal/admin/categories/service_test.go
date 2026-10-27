package categories

import (
	"strings"
	"testing"
)

func TestNewIDIsReadableSlug(t *testing.T) {
	id := newID("  Kingdom Finance & Wisdom!  ")
	if !strings.HasPrefix(id, "cat-kingdom-finance-wisdom-") {
		t.Fatalf("unexpected id %q", id)
	}
	if strings.Contains(id, "--") {
		t.Fatalf("id should not contain double dashes: %q", id)
	}
	if newID("???") == "" || !strings.HasPrefix(newID("???"), "cat-category-") {
		t.Fatalf("empty slug should fall back to 'category': %q", newID("???"))
	}
}
