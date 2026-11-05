package mail

import (
	"io"
	"mime"
	"mime/multipart"
	"strings"
	"testing"
)

// The message is a text copy plus an HTML copy with the dove attached inline,
// every line short enough for SMTP, and user text escaped.
func TestMimeBodyStructure(t *testing.T) {
	ct, body := mimeBody(Message{Subject: "S", Heading: "Hi <b>", Intro: "Line one\n\nLine two", Highlight: "123456",
		Rows: []Row{{"Name", "Grace"}}, Button: &Button{"Reply", "mailto:g@example.com"}})
	for _, l := range strings.Split(body, "\r\n") {
		if len(l) > 998 {
			t.Fatalf("line too long: %d", len(l))
		}
	}
	_, params, err := mime.ParseMediaType(ct)
	if err != nil {
		t.Fatal(err)
	}
	r := multipart.NewReader(strings.NewReader(body), params["boundary"])
	var types []string
	for {
		p, err := r.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		pt, pp, _ := mime.ParseMediaType(p.Header.Get("Content-Type"))
		types = append(types, pt)
		if pt == "multipart/related" {
			rr := multipart.NewReader(p, pp["boundary"])
			for {
				q, err := rr.NextPart()
				if err == io.EOF {
					break
				}
				if err != nil {
					t.Fatal(err)
				}
				qt, _, _ := mime.ParseMediaType(q.Header.Get("Content-Type"))
				types = append(types, qt)
				if qt == "image/png" && q.Header.Get("Content-Id") != "<"+doveCID+">" {
					t.Fatalf("dove Content-ID = %q", q.Header.Get("Content-Id"))
				}
			}
		}
	}
	if strings.Join(types, ",") != "text/plain,multipart/related,text/html,image/png" {
		t.Fatalf("parts = %v", types)
	}
	html := htmlBody(Message{Heading: "Hi <b>", Intro: "a\n\nb"})
	if strings.Contains(html, "Hi <b>") || !strings.Contains(html, "Hi &lt;b&gt;") || !strings.Contains(html, "cid:"+doveCID) {
		t.Fatal("heading must be escaped and the dove referenced")
	}
	if strings.Count(html, "<p style=\"margin:0 0 14px") != 2 {
		t.Fatal("blank lines should split the intro into paragraphs")
	}
}
