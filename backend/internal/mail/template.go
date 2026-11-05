package mail

import (
	_ "embed"
	"encoding/base64"
	"fmt"
	"html"
	"strings"
	"time"
)

// The gold dove, sent inside each email (Content-ID) so it shows even when a
// mail app blocks images from the web.
//
//go:embed dove.png
var dovePNG []byte

const doveCID = "dove@shekinah"

// Button is an optional call to action, drawn as a gold pill.
type Button struct{ Label, URL string }

// Brand colours, kept to what renders the same in Gmail, Outlook and phones.
const (
	cPage    = "#f4efe4"
	cCard    = "#ffffff"
	cInk     = "#17150f"
	cBody    = "#3d3729"
	cMuted   = "#7a7262"
	cGold    = "#d4af37"
	cGoldInk = "#8f6d0f"
	cLine    = "#ece4d2"
	cPanel   = "#faf6ec"
	cHeader  = "#121214"
)

func plain(m Message) string {
	var b strings.Builder
	if m.Eyebrow != "" {
		b.WriteString(strings.ToUpper(m.Eyebrow) + "\n")
	}
	b.WriteString(m.Heading + "\n\n")
	if m.Intro != "" {
		b.WriteString(m.Intro + "\n\n")
	}
	if m.Highlight != "" {
		b.WriteString("    " + m.Highlight + "\n\n")
	}
	for _, r := range m.Rows {
		b.WriteString(r.Label + ": " + r.Value + "\n")
	}
	if m.Button != nil {
		b.WriteString("\n" + m.Button.Label + ": " + m.Button.URL + "\n")
	}
	if m.Footer != "" {
		b.WriteString("\n" + m.Footer + "\n")
	}
	b.WriteString("\nBlessings,\nShekinah Sons Global\n")
	return b.String()
}

// paragraphs turns text into <p> blocks: blank lines split paragraphs and
// single line breaks stay as <br>.
func paragraphs(text, style string) string {
	var out strings.Builder
	for _, p := range strings.Split(strings.ReplaceAll(strings.TrimSpace(text), "\r\n", "\n"), "\n\n") {
		if p = strings.TrimSpace(p); p == "" {
			continue
		}
		out.WriteString(`<p style="` + style + `">` + strings.ReplaceAll(html.EscapeString(p), "\n", "<br>") + `</p>`)
	}
	return out.String()
}

func htmlBody(m Message) string {
	e := html.EscapeString
	font := `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;`

	preheader := m.Preheader
	if preheader == "" {
		preheader = m.Intro
	}
	if len(preheader) > 140 {
		preheader = preheader[:137] + "..."
	}

	var body strings.Builder
	if m.Eyebrow != "" {
		body.WriteString(`<p style="margin:0 0 10px;` + font + `font-size:11px;line-height:14px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:` + cGoldInk + `">` + e(m.Eyebrow) + `</p>`)
	}
	body.WriteString(`<h1 style="margin:0 0 14px;` + font + `font-size:25px;line-height:32px;font-weight:700;color:` + cInk + `">` + e(m.Heading) + `</h1>`)
	body.WriteString(paragraphs(m.Intro, `margin:0 0 14px;`+font+`font-size:16px;line-height:26px;color:`+cBody))

	if m.Highlight != "" {
		body.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px"><tr><td align="center" style="background:` + cPanel + `;border:1px dashed ` + cGold + `;border-radius:16px;padding:20px 12px">` +
			`<p style="margin:0 0 6px;` + font + `font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:` + cMuted + `">Your code</p>` +
			`<p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:36px;line-height:44px;letter-spacing:10px;font-weight:700;color:` + cInk + `">` + e(m.Highlight) + `</p>` +
			`</td></tr></table>`)
	}

	if len(m.Rows) > 0 {
		body.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;background:` + cPanel + `;border-radius:16px"><tr><td style="padding:6px 20px">`)
		body.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`)
		for i, r := range m.Rows {
			border := "border-top:1px solid " + cLine + ";"
			if i == 0 {
				border = ""
			}
			body.WriteString(`<tr><td valign="top" style="` + border + `padding:12px 12px 12px 0;width:34%;` + font + `font-size:11px;line-height:18px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:` + cMuted + `">` + e(r.Label) + `</td>` +
				`<td valign="top" style="` + border + `padding:12px 0;` + font + `font-size:15px;line-height:22px;color:` + cInk + `">` + strings.ReplaceAll(e(r.Value), "\n", "<br>") + `</td></tr>`)
		}
		body.WriteString(`</table></td></tr></table>`)
	}

	if m.Button != nil && m.Button.URL != "" {
		body.WriteString(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px"><tr><td align="center" bgcolor="` + cGold + `" style="border-radius:999px;background:` + cGold + `;background-image:linear-gradient(135deg,#f5de8a,#d4af37 55%,#b8901c)">` +
			`<a href="` + e(m.Button.URL) + `" style="display:inline-block;padding:14px 30px;` + font + `font-size:15px;font-weight:700;color:#17150f;text-decoration:none;border-radius:999px">` + e(m.Button.Label) + `</a></td></tr></table>`)
	}

	body.WriteString(`<p style="margin:26px 0 0;` + font + `font-size:15px;line-height:24px;color:` + cBody + `">Blessings,<br><strong style="color:` + cInk + `">Shekinah Sons Global</strong></p>`)

	if m.Footer != "" {
		body.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr><td style="border-top:1px solid ` + cLine + `;padding-top:16px">` +
			paragraphs(m.Footer, `margin:0 0 6px;`+font+`font-size:13px;line-height:20px;color:`+cMuted) + `</td></tr></table>`)
	}

	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>` + e(m.Subject) + `</title></head>
<body style="margin:0;padding:0;background:` + cPage + `;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">` + e(preheader) + `</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="` + cPage + `" style="background:` + cPage + `">
<tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td align="center" bgcolor="` + cHeader + `" style="background:` + cHeader + `;background-image:radial-gradient(ellipse at 50% 0%,#3a2e0c 0%,#121214 70%);border-radius:22px 22px 0 0;padding:30px 24px 24px">
<img src="cid:` + doveCID + `" width="56" height="56" alt="" style="display:block;border:0;width:56px;height:56px;margin:0 auto 10px">
<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:26px;letter-spacing:6px;font-weight:700;color:#f0d27a">SHEKINAH</p>
<p style="margin:4px 0 0;` + font + `font-size:10px;line-height:14px;letter-spacing:5px;color:#b8b8bd">SONS GLOBAL</p>
</td></tr>
<tr><td height="4" bgcolor="` + cGold + `" style="height:4px;line-height:4px;font-size:0;background:` + cGold + `;background-image:linear-gradient(90deg,#a8841f,#f5de8a,#d4af37,#a8841f)">&nbsp;</td></tr>
<tr><td bgcolor="` + cCard + `" style="background:` + cCard + `;border-radius:0 0 22px 22px;padding:34px 34px 30px;border:1px solid ` + cLine + `;border-top:0">` + body.String() + `</td></tr>
<tr><td align="center" style="padding:22px 20px 0;` + font + `font-size:12px;line-height:18px;color:` + cMuted + `">
Sent by the Shekinah Sons Global app.<br>&copy; ` + fmt.Sprint(time.Now().Year()) + ` Shekinah Sons Global
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

// wrap76 base64-encodes data in 76-character lines, as email requires.
func wrap76(data []byte) string {
	s := base64.StdEncoding.EncodeToString(data)
	var b strings.Builder
	for len(s) > 76 {
		b.WriteString(s[:76] + "\r\n")
		s = s[76:]
	}
	b.WriteString(s)
	return b.String()
}

// mimeBody builds the message body: a plain-text copy and an HTML copy with
// the dove attached inline.
func mimeBody(m Message) (contentType, body string) {
	alt, rel := randomHex(12), randomHex(12)
	var b strings.Builder
	b.WriteString("--" + alt + "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + wrap76([]byte(plain(m))) + "\r\n")
	b.WriteString("--" + alt + "\r\nContent-Type: multipart/related; boundary=\"" + rel + "\"\r\n\r\n")
	b.WriteString("--" + rel + "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + wrap76([]byte(htmlBody(m))) + "\r\n")
	b.WriteString("--" + rel + "\r\nContent-Type: image/png; name=\"shekinah.png\"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <" + doveCID + ">\r\nContent-Disposition: inline; filename=\"shekinah.png\"\r\n\r\n" + wrap76(dovePNG) + "\r\n")
	b.WriteString("--" + rel + "--\r\n")
	b.WriteString("--" + alt + "--\r\n")
	return `multipart/alternative; boundary="` + alt + `"`, b.String()
}
