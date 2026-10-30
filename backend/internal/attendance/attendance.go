// Package attendance records who came: at the gate, an usher (anyone with
// the check-in permission) scans a member's QR code or an event ticket, and
// the member is marked present for that service or event. Records can be
// listed and downloaded as a PDF.
package attendance

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-pdf/fpdf"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ariga/shekinah-backend/internal/auth"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) Handler { return Handler{db: db} }

var nairobi = func() *time.Location {
	if l, err := time.LoadLocation("Africa/Nairobi"); err == nil {
		return l
	}
	return time.FixedZone("EAT", 3*3600)
}()

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func today() string { return time.Now().In(nairobi).Format("2006-01-02") }

type Record struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Occasion  string    `json:"occasion"`
	Date      string    `json:"date"`
	Method    string    `json:"method"`
	By        string    `json:"by"`
	CreatedAt time.Time `json:"createdAt"`
}

// POST /attendance/scan {"code": "<scanned text>", "occasion": "Sunday Service"}
// The code is a member's check-in code, or an event ticket
// ("SSG-EVENT:<event id>:<ticket>"), which also names the occasion.
func (h Handler) Scan(c *gin.Context) {
	scanner, _ := auth.UserIDFromContext(c)
	var req struct {
		Code     string `json:"code"`
		Occasion string `json:"occasion"`
	}
	_ = c.ShouldBindJSON(&req)
	code := strings.TrimSpace(req.Code)
	occasion := strings.TrimSpace(req.Occasion)
	ctx := c.Request.Context()

	var userID, name, email, eventID, method string
	if strings.HasPrefix(code, "SSG-EVENT:") {
		// An event ticket: valid if registered (and paid, for paid events).
		parts := strings.Split(code, ":")
		if len(parts) != 3 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "That isn't a valid ticket"})
			return
		}
		eventID, method = parts[1], "ticket"
		var price int
		err := h.db.QueryRow(ctx, `SELECT u.id::text, u.name, u.email, e.title, e.price FROM event_registrations r
			JOIN users u ON u.id = r.user_id JOIN events e ON e.id = r.event_id WHERE r.event_id = $1 AND r.ticket = $2`, eventID, parts[2]).
			Scan(&userID, &name, &email, &occasion, &price)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Ticket not found. It may have been cancelled."})
			return
		}
		if price > 0 {
			var paid bool
			_ = h.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM giving_transactions WHERE item_id = $1 AND user_id::text = $2 AND status = 'success')`, eventID, userID).Scan(&paid)
			if !paid {
				c.JSON(http.StatusPaymentRequired, gin.H{"message": name + "'s payment for this event hasn't been confirmed yet.", "name": name})
				return
			}
		}
	} else {
		method = "qr"
		clean := strings.ToUpper(strings.ReplaceAll(code, " ", ""))
		err := h.db.QueryRow(ctx, `SELECT u.id::text, u.name, u.email FROM member_checkin_codes k JOIN users u ON u.id = k.user_id
			WHERE k.code = $1 AND k.updated_at >= NOW() - INTERVAL '30 minutes' AND u.is_active`, clean).Scan(&userID, &name, &email)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Code not recognised or expired. Ask the member to refresh their code."})
			return
		}
		if occasion == "" {
			occasion = "Service"
		}
	}
	if len(occasion) > 120 {
		occasion = occasion[:120]
	}
	date := today()
	tag, err := h.db.Exec(ctx, `INSERT INTO attendance (id, user_id, occasion, occasion_date, event_id, method, checked_in_by)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::uuid) ON CONFLICT (user_id, occasion, occasion_date) DO NOTHING`,
		"att-"+randomHex(6), userID, occasion, date, eventID, method, scanner)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not record attendance"})
		return
	}
	var count int
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM attendance WHERE occasion = $1 AND occasion_date = $2`, occasion, date).Scan(&count)
	c.JSON(http.StatusOK, gin.H{
		"name": name, "email": email, "occasion": occasion, "date": date, "method": method,
		"already": tag.RowsAffected() == 0, "count": count,
	})
}

func (h Handler) records(c *gin.Context) ([]Record, string, string, error) {
	date := strings.TrimSpace(c.Query("date"))
	if _, err := time.Parse("2006-01-02", date); err != nil {
		date = today()
	}
	occasion := strings.TrimSpace(c.Query("occasion"))
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT a.id, u.name, u.email, COALESCE((SELECT g.phone FROM giving_transactions g WHERE g.user_id = a.user_id AND g.phone <> '' ORDER BY g.created_at DESC LIMIT 1), ''),
			a.occasion, to_char(a.occasion_date, 'YYYY-MM-DD'), a.method, COALESCE(s.name, ''), a.created_at
		FROM attendance a JOIN users u ON u.id = a.user_id LEFT JOIN users s ON s.id = a.checked_in_by
		WHERE a.occasion_date = $1 AND ($2 = '' OR a.occasion = $2) ORDER BY a.created_at`, date, occasion)
	if err != nil {
		return nil, date, occasion, err
	}
	defer rows.Close()
	out := make([]Record, 0)
	for rows.Next() {
		var r Record
		if err := rows.Scan(&r.ID, &r.Name, &r.Email, &r.Phone, &r.Occasion, &r.Date, &r.Method, &r.By, &r.CreatedAt); err != nil {
			return nil, date, occasion, err
		}
		out = append(out, r)
	}
	return out, date, occasion, rows.Err()
}

// GET /attendance?date=YYYY-MM-DD&occasion= — the day's records, the
// occasions held that day, and recent days with counts.
func (h Handler) List(c *gin.Context) {
	list, date, occasion, err := h.records(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load attendance"})
		return
	}
	type count struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	occasions := []count{}
	rows, err := h.db.Query(c.Request.Context(), `SELECT occasion, COUNT(*) FROM attendance WHERE occasion_date = $1 GROUP BY occasion ORDER BY MIN(created_at)`, date)
	if err == nil {
		for rows.Next() {
			var x count
			if rows.Scan(&x.Name, &x.Count) == nil {
				occasions = append(occasions, x)
			}
		}
		rows.Close()
	}
	days := []count{}
	rows, err = h.db.Query(c.Request.Context(), `SELECT to_char(occasion_date, 'YYYY-MM-DD'), COUNT(*) FROM attendance GROUP BY occasion_date ORDER BY occasion_date DESC LIMIT 30`)
	if err == nil {
		for rows.Next() {
			var x count
			if rows.Scan(&x.Name, &x.Count) == nil {
				days = append(days, x)
			}
		}
		rows.Close()
	}
	c.JSON(http.StatusOK, gin.H{"date": date, "occasion": occasion, "records": list, "occasions": occasions, "days": days})
}

// GET /attendance/report.pdf?date=&occasion= — the same list as a PDF.
func (h Handler) PDF(c *gin.Context) {
	list, date, occasion, err := h.records(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load attendance"})
		return
	}
	d, _ := time.Parse("2006-01-02", date)
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(14, 16, 14)
	pdf.SetAutoPageBreak(true, 16)
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	title := "Attendance"
	if occasion != "" {
		title = occasion
	}
	pdf.SetFooterFunc(func() {
		pdf.SetY(-12)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(140, 140, 145)
		pdf.CellFormat(0, 6, tr(fmt.Sprintf("Shekinah Sons Global  ·  %s  ·  page %d", title, pdf.PageNo())), "", 0, "C", false, 0, "")
	})
	pdf.AddPage()
	// Header band
	pdf.SetFillColor(17, 17, 19)
	pdf.Rect(0, 0, 210, 34, "F")
	pdf.SetFillColor(212, 175, 55)
	pdf.Rect(0, 34, 210, 1.2, "F")
	pdf.SetXY(14, 9)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(212, 175, 55)
	pdf.CellFormat(0, 5, "SHEKINAH SONS GLOBAL", "", 1, "L", false, 0, "")
	pdf.SetX(14)
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(0, 9, tr(title), "", 1, "L", false, 0, "")
	pdf.SetX(14)
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(200, 200, 205)
	pdf.CellFormat(0, 6, tr(fmt.Sprintf("%s  ·  %d present", d.Format("Monday 2 January 2006"), len(list))), "", 1, "L", false, 0, "")
	pdf.Ln(8)

	widths := []float64{10, 52, 62, 26, 32}
	head := []string{"#", "Name", "Email", "Time", "Recorded by"}
	if occasion == "" {
		widths = []float64{9, 44, 52, 32, 18, 27}
		head = []string{"#", "Name", "Email", "Occasion", "Time", "Recorded by"}
	}
	header := func() {
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(240, 210, 122)
		pdf.SetTextColor(20, 20, 20)
		for i, hd := range head {
			pdf.CellFormat(widths[i], 8, tr(hd), "", 0, "L", true, 0, "")
		}
		pdf.Ln(-1)
	}
	header()
	pdf.SetFont("Helvetica", "", 9)
	for i, r := range list {
		cells := []string{fmt.Sprint(i + 1), r.Name, r.Email, r.CreatedAt.In(nairobi).Format("3:04 PM"), r.By}
		if occasion == "" {
			cells = []string{fmt.Sprint(i + 1), r.Name, r.Email, r.Occasion, r.CreatedAt.In(nairobi).Format("3:04 PM"), r.By}
		}
		// Keep complete names and contact details. Size the whole row for its
		// tallest wrapped cell so text never overlaps the following record.
		rowHeight := 7.0
		for j, v := range cells {
			if height := float64(len(pdf.SplitLines([]byte(tr(v)), widths[j]-2)))*4.5 + 2; height > rowHeight {
				rowHeight = height
			}
		}
		if pdf.GetY()+rowHeight > 281 {
			pdf.AddPage()
			header()
			pdf.SetFont("Helvetica", "", 9)
		}
		if i%2 == 0 {
			pdf.SetFillColor(247, 245, 238)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		pdf.SetTextColor(30, 30, 30)
		x, y := pdf.GetX(), pdf.GetY()
		for j, v := range cells {
			pdf.Rect(x, y, widths[j], rowHeight, "F")
			pdf.SetXY(x+1, y+1)
			pdf.MultiCell(widths[j]-2, 4.5, tr(v), "", "L", false)
			x += widths[j]
		}
		pdf.SetXY(14, y+rowHeight)
	}
	if len(list) == 0 {
		pdf.SetTextColor(120, 120, 125)
		pdf.CellFormat(0, 12, "No one was recorded for this day.", "", 1, "C", false, 0, "")
	}
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not build the PDF"})
		return
	}
	name := "attendance-" + date
	if occasion != "" {
		name += "-" + strings.ReplaceAll(strings.ToLower(occasion), " ", "-")
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name+".pdf"))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}
