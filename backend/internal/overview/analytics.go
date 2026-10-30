package overview

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Classification follows the purchased item, never the editable payment note.
// Live and replay share one item/entitlement; purchase time distinguishes sales.
const classifiedPayments = `WITH classified AS (
 SELECT t.id,t.item_id,t.amount,t.status,t.currency,t.created_at,
 CASE WHEN t.item_id='' THEN 'donations' WHEN b.id IS NOT NULL THEN 'books'
 WHEN e.id IS NOT NULL THEN 'events' WHEN l.id IS NOT NULL AND l.ended_at IS NOT NULL AND t.created_at>=l.ended_at THEN 'replays'
 WHEN l.id IS NOT NULL THEN 'live' ELSE 'other' END AS kind,
 COALESCE(b.title,e.title,l.title,NULLIF(t.category,''),'Unclassified purchase') AS title
 FROM giving_transactions t LEFT JOIN library_items b ON b.id=t.item_id
 LEFT JOIN events e ON e.id=t.item_id LEFT JOIN live_sessions l ON l.id=t.item_id
 WHERE t.created_at >= $1 AND t.created_at < $2 AND t.currency=$3 AND ($4='' OR t.item_id=$4)
) `

type Amounts struct {
	Confirmed    int64 `json:"confirmed"`
	Pending      int64 `json:"pending"`
	Failed       int64 `json:"failed"`
	Cancelled    int64 `json:"cancelled"`
	Sales        int64 `json:"sales"`
	Transactions int64 `json:"transactions"`
}

func (a *Amounts) add(status string, amount, count int64) {
	a.Transactions += count
	switch status {
	case "success":
		a.Confirmed += amount
		a.Sales += count
	case "pending", "awaiting_verification":
		a.Pending += amount
	case "failed":
		a.Failed += amount
	case "cancelled":
		a.Cancelled += amount
	}
}

type IncomeRow struct {
	Kind  string `json:"kind"`
	ID    string `json:"id"`
	Title string `json:"title"`
	Amounts
}
type TrendRow struct {
	Date string `json:"date"`
	Amounts
}
type Analytics struct {
	From     string      `json:"from"`
	To       string      `json:"to"`
	Currency string      `json:"currency"`
	Totals   Amounts     `json:"totals"`
	Streams  []IncomeRow `json:"streams"`
	Items    []IncomeRow `json:"items"`
	Trend    []TrendRow  `json:"trend"`
}

func AnalyticsHandler(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		zone := time.FixedZone("Africa/Nairobi", 3*3600)
		now := time.Now().In(zone)
		fromRaw, toRaw := c.DefaultQuery("from", now.Format("2006-01")+"-01"), c.DefaultQuery("to", now.Format("2006-01-02"))
		from, e1 := time.ParseInLocation("2006-01-02", fromRaw, zone)
		to, e2 := time.ParseInLocation("2006-01-02", toRaw, zone)
		currency := strings.ToUpper(c.DefaultQuery("currency", "KES"))
		item := c.Query("item")
		if len(item) > 200 || strings.ContainsRune(item, 0) {
			c.JSON(400, gin.H{"message": "Invalid item filter"})
			return
		}
		if e1 != nil || e2 != nil || to.Before(from) || to.Sub(from) > 3660*24*time.Hour || len(currency) != 3 || strings.IndexFunc(currency, func(r rune) bool { return r < 'A' || r > 'Z' }) >= 0 {
			c.JSON(400, gin.H{"message": "Choose a valid date range (up to ten years) and three-letter currency"})
			return
		}
		rows, err := db.Query(c.Request.Context(), classifiedPayments+`SELECT kind,item_id,title,status,to_char(created_at AT TIME ZONE 'Africa/Nairobi','YYYY-MM-DD'),SUM(amount)::bigint,COUNT(*) FROM classified GROUP BY kind,item_id,title,status,5 ORDER BY 5,kind,item_id`, from, to.AddDate(0, 0, 1), currency, item)
		if err != nil {
			c.JSON(500, gin.H{"message": "Could not load income analytics"})
			return
		}
		defer rows.Close()
		out := Analytics{From: fromRaw, To: toRaw, Currency: currency, Streams: []IncomeRow{}, Items: []IncomeRow{}, Trend: []TrendRow{}}
		streams := map[string]*IncomeRow{}
		items := map[string]*IncomeRow{}
		days := map[string]*TrendRow{}
		for _, kind := range []string{"donations", "books", "events", "live", "replays", "other"} {
			streams[kind] = &IncomeRow{Kind: kind, Title: kind}
		}
		for rows.Next() {
			var kind, id, title, status, day string
			var amount, count int64
			if err = rows.Scan(&kind, &id, &title, &status, &day, &amount, &count); err != nil {
				break
			}
			out.Totals.add(status, amount, count)
			streams[kind].add(status, amount, count)
			key := kind + ":" + id
			if kind == "donations" {
				key += ":" + title
			}
			if items[key] == nil {
				items[key] = &IncomeRow{Kind: kind, ID: id, Title: title}
			}
			items[key].add(status, amount, count)
			if days[day] == nil {
				days[day] = &TrendRow{Date: day}
			}
			days[day].add(status, amount, count)
		}
		if err != nil || rows.Err() != nil {
			c.JSON(500, gin.H{"message": "Could not read income analytics"})
			return
		}
		for _, kind := range []string{"donations", "books", "events", "live", "replays", "other"} {
			out.Streams = append(out.Streams, *streams[kind])
		}
		for _, item := range items {
			out.Items = append(out.Items, *item)
		}
		sort.Slice(out.Items, func(i, j int) bool {
			if out.Items[i].Confirmed == out.Items[j].Confirmed {
				return out.Items[i].Title < out.Items[j].Title
			}
			return out.Items[i].Confirmed > out.Items[j].Confirmed
		})
		for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
			day := d.Format("2006-01-02")
			if row := days[day]; row != nil {
				out.Trend = append(out.Trend, *row)
			} else {
				out.Trend = append(out.Trend, TrendRow{Date: day})
			}
		}
		c.Header("Cache-Control", "no-store")
		if c.Query("format") == "csv" {
			c.Header("Content-Type", "text/csv; charset=utf-8")
			c.Header("Content-Disposition", `attachment; filename="shekinah-income.csv"`)
			w := csv.NewWriter(c.Writer)
			_ = w.Write([]string{"Type", "Item", "Title", "Currency", "Confirmed", "Pending", "Failed", "Cancelled", "Confirmed transactions", "All transactions"})
			for _, r := range out.Items {
				_ = w.Write([]string{r.Kind, csvSafe(r.ID), csvSafe(r.Title), currency, fmt.Sprint(r.Confirmed), fmt.Sprint(r.Pending), fmt.Sprint(r.Failed), fmt.Sprint(r.Cancelled), fmt.Sprint(r.Sales), fmt.Sprint(r.Transactions)})
			}
			w.Flush()
			return
		}
		c.JSON(http.StatusOK, out)
	}
}
func csvSafe(v string) string {
	if strings.HasPrefix(strings.TrimSpace(v), "=") || strings.HasPrefix(strings.TrimSpace(v), "+") || strings.HasPrefix(strings.TrimSpace(v), "-") || strings.HasPrefix(strings.TrimSpace(v), "@") || strings.HasPrefix(v, "\t") || strings.HasPrefix(v, "\r") {
		return "'" + v
	}
	return v
}
