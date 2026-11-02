package auth

import "testing"

func TestNormalizePhone(t *testing.T) {
	good := map[string]string{
		"0712345678": "+254712345678", "0712 345 678": "+254712345678", "712345678": "+254712345678",
		"254712345678": "+254712345678", "+254 712 345 678": "+254712345678", "0110123456": "+254110123456",
		"+44 7911 123456": "+447911123456",
	}
	for in, want := range good {
		if got, err := NormalizePhone(in); err != nil || got != want {
			t.Errorf("%q: got %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "12345", "0812345678", "abc", "+1"} {
		if _, err := NormalizePhone(in); err == nil {
			t.Errorf("%q should be rejected", in)
		}
	}
}
