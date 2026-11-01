package live

// Branded replay covers: a bright, glowing Shekinah card (gradient, light
// burst, gold dove, the service title in big letters and the date) instead of
// a frame grabbed from the video. Drawn in Go so no system fonts are needed.
import (
	"bytes"
	_ "embed"
	"hash/fnv"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"

	xdraw "golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

var (
	//go:embed coverassets/anton_regular.ttf
	antonTTF []byte
	//go:embed coverassets/cinzel_bold.ttf
	cinzelTTF []byte
	//go:embed coverassets/inter_semibold.ttf
	interTTF []byte
	//go:embed coverassets/dove.png
	dovePNG []byte
)

type coverPalette struct{ from, to, glow color.RGBA }

// Bright palettes; each recording gets one by its id so a rail of replays isn't
// all the same colour.
var coverPalettes = []coverPalette{
	{color.RGBA{0x0a, 0x3d, 0xc8, 255}, color.RGBA{0x00, 0xb4, 0xff, 255}, color.RGBA{0xff, 0xd9, 0x6a, 255}}, // sapphire to sky, gold light
	{color.RGBA{0xd4, 0x1c, 0x4f, 255}, color.RGBA{0xff, 0x9a, 0x1f, 255}, color.RGBA{0xff, 0xf1, 0xb0, 255}}, // crimson to amber
	{color.RGBA{0x5b, 0x1f, 0xd6, 255}, color.RGBA{0xe0, 0x3c, 0xc8, 255}, color.RGBA{0xff, 0xd0, 0x7a, 255}}, // violet to magenta
	{color.RGBA{0x00, 0x8a, 0x7a, 255}, color.RGBA{0x2e, 0xd1, 0x6c, 255}, color.RGBA{0xff, 0xf3, 0x9a, 255}}, // teal to green
	{color.RGBA{0xb8, 0x6a, 0x00, 255}, color.RGBA{0xff, 0xc4, 0x2e, 255}, color.RGBA{0xff, 0xff, 0xe0, 255}}, // deep gold to sun
}

var (
	coverOnce                           sync.Once
	coverAnton, coverCinzel, coverInter *opentype.Font
	coverDove                           image.Image
	coverErr                            error
)

func loadCoverAssets() error {
	coverOnce.Do(func() {
		if coverAnton, coverErr = opentype.Parse(antonTTF); coverErr != nil {
			return
		}
		if coverCinzel, coverErr = opentype.Parse(cinzelTTF); coverErr != nil {
			return
		}
		if coverInter, coverErr = opentype.Parse(interTTF); coverErr != nil {
			return
		}
		coverDove, coverErr = png.Decode(bytes.NewReader(dovePNG))
	})
	return coverErr
}

func face(f *opentype.Font, size float64) font.Face {
	fc, _ := opentype.NewFace(f, &opentype.FaceOptions{Size: size, DPI: 72, Hinting: font.HintingFull})
	return fc
}

func lerp(a, b uint8, t float64) uint8 { return uint8(float64(a) + (float64(b)-float64(a))*t) }

// blend adds colour c with strength t (0..1) over the pixel.
func blend(img *image.RGBA, x, y int, c color.RGBA, t float64) {
	if t <= 0 {
		return
	}
	t = math.Min(t, 1)
	i := img.PixOffset(x, y)
	p := img.Pix[i : i+3 : i+3]
	p[0], p[1], p[2] = lerp(p[0], c.R, t), lerp(p[1], c.G, t), lerp(p[2], c.B, t)
}

// wrap splits the title into at most maxLines lines that fit width.
func wrap(fc font.Face, text string, width int, maxLines int) []string {
	words := strings.Fields(text)
	lines := []string{}
	cur := ""
	for _, w := range words {
		try := strings.TrimSpace(cur + " " + w)
		if font.MeasureString(fc, try).Ceil() <= width || cur == "" {
			cur = try
			continue
		}
		lines = append(lines, cur)
		cur = w
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	if len(lines) > maxLines {
		lines = lines[:maxLines]
		last := lines[maxLines-1]
		for font.MeasureString(fc, last+"…").Ceil() > width && len(last) > 1 {
			last = strings.TrimSpace(last[:len(last)-1])
		}
		lines[maxLines-1] = last + "…"
	}
	return lines
}

func drawText(img *image.RGBA, fc font.Face, x, y int, text string, c color.Color, shadow bool) {
	if shadow {
		d := &font.Drawer{Dst: img, Src: image.NewUniform(color.RGBA{0, 0, 0, 70}), Face: fc, Dot: fixed.P(x+3, y+4)}
		d.DrawString(text)
	}
	d := &font.Drawer{Dst: img, Src: image.NewUniform(c), Face: fc, Dot: fixed.P(x, y)}
	d.DrawString(text)
}

// RenderReplayCover draws a 1280x720 JPEG cover for a recorded service.
func RenderReplayCover(seed, title string, date time.Time) ([]byte, error) {
	sub := ""
	if !date.IsZero() {
		if nairobi, err := time.LoadLocation("Africa/Nairobi"); err == nil {
			date = date.In(nairobi)
		}
		sub = date.Format("Monday, 2 January 2006")
	}
	return RenderCover(seed, "SERVICE REPLAY", title, sub)
}

// RenderCover draws a bright branded 1280x720 JPEG: a small label pill, the
// title in big letters and a subtitle line (date or speaker).
func RenderCover(seed, labelText, title, subtitle string) ([]byte, error) {
	if err := loadCoverAssets(); err != nil {
		return nil, err
	}
	const W, H = 1280, 720
	h := fnv.New32a()
	_, _ = h.Write([]byte(seed))
	pal := coverPalettes[h.Sum32()%uint32(len(coverPalettes))]
	img := image.NewRGBA(image.Rect(0, 0, W, H))

	// Diagonal gradient, a light burst from the upper right and a soft glow.
	gx, gy := float64(W)*0.78, float64(H)*0.22
	for y := 0; y < H; y++ {
		for x := 0; x < W; x++ {
			t := (float64(x)/W*0.6 + float64(y)/H*0.4)
			i := img.PixOffset(x, y)
			img.Pix[i], img.Pix[i+1], img.Pix[i+2], img.Pix[i+3] = lerp(pal.from.R, pal.to.R, t), lerp(pal.from.G, pal.to.G, t), lerp(pal.from.B, pal.to.B, t), 255
			dx, dy := float64(x)-gx, float64(y)-gy
			dist := math.Hypot(dx, dy)
			ray := math.Pow(math.Abs(math.Sin(math.Atan2(dy, dx)*9)), 6) * 0.22 * math.Max(0, 1-dist/900)
			glow := math.Exp(-dist*dist/(2*230*230)) * 0.85
			blend(img, x, y, pal.glow, glow+ray)
			// Darken the lower left a little so the title reads clearly.
			shade := math.Max(0, (float64(y)/H-0.35)) * math.Max(0, 1-float64(x)/W*1.1) * 0.55
			blend(img, x, y, color.RGBA{0, 0, 0, 255}, shade)
		}
	}
	// Floating light specks.
	r := h.Sum32()
	for k := 0; k < 40; k++ {
		r = r*1664525 + 1013904223
		cx, cy := int(r%W), int((r>>12)%H)
		rad := 2 + int((r>>24)%5)
		for y := -rad * 3; y <= rad*3; y++ {
			for x := -rad * 3; x <= rad*3; x++ {
				px, py := cx+x, cy+y
				if px < 0 || py < 0 || px >= W || py >= H {
					continue
				}
				d := math.Hypot(float64(x), float64(y))
				blend(img, px, py, color.RGBA{255, 255, 255, 255}, math.Exp(-d*d/float64(2*rad*rad))*0.45)
			}
		}
	}

	// Gold dove and the ministry name.
	xdraw.CatmullRom.Scale(img, image.Rect(56, 44, 56+120, 44+120), coverDove, coverDove.Bounds(), xdraw.Over, nil)
	white := color.RGBA{255, 255, 255, 255}
	drawText(img, face(coverCinzel, 40), 190, 100, "SHEKINAH", white, true)
	drawText(img, face(coverCinzel, 24), 192, 138, "SONS GLOBAL", color.RGBA{255, 240, 200, 255}, true)

	// "SERVICE REPLAY" pill.
	label := face(coverInter, 22)
	text := labelText
	tw := font.MeasureString(label, text).Ceil()
	pill := image.Rect(64, 300, 64+tw+44, 300+46)
	for y := pill.Min.Y; y < pill.Max.Y; y++ {
		for x := pill.Min.X; x < pill.Max.X; x++ {
			// Rounded ends.
			rr := 23.0
			cx := math.Min(math.Max(float64(x), float64(pill.Min.X)+rr), float64(pill.Max.X)-rr)
			if math.Hypot(float64(x)-cx, float64(y)-(float64(pill.Min.Y)+rr)) <= rr {
				blend(img, x, y, white, 0.95)
			}
		}
	}
	drawText(img, label, 64+22, 300+31, text, pal.from, false)

	// The title, big and bold.
	title = strings.ToUpper(strings.TrimSpace(title))
	if title == "" {
		title = "Sunday Service"
	}
	size := 104.0
	var big font.Face
	var lines []string
	for {
		big = face(coverAnton, size)
		lines = wrap(big, title, W-140, 3)
		if len(lines) <= 2 || size <= 76 {
			break
		}
		size -= 10
	}
	y := 400 + int(size)
	for _, line := range lines {
		drawText(img, big, 64, y, line, white, true)
		y += int(size * 1.02)
	}
	if subtitle != "" {
		drawText(img, face(coverInter, 28), 66, min(y+14, H-36), subtitle, color.RGBA{255, 255, 255, 255}, true)
	}

	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: 88}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
