// Package overview gives admins the numbers that need attention today.
package overview

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Overview struct {
	Members         int    `json:"members"`
	NewMembersWeek  int    `json:"newMembersWeek"`
	PendingPayments int    `json:"pendingPayments"`
	PendingAmount   int    `json:"pendingAmount"`
	GivenThisMonth  int    `json:"givenThisMonth"`
	Books           int    `json:"books"`
	BookSalesMonth  int    `json:"bookSalesMonth"`
	NewPrayers      int    `json:"newPrayers"`
	ChatToday       int    `json:"chatToday"`
	LiveTitle       string `json:"liveTitle"`
	LiveStatus      string `json:"liveStatus"`
}

// Handle: GET /admin/overview
func Handle(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var o Overview
		err := db.QueryRow(c.Request.Context(), `SELECT
			(SELECT COUNT(*) FROM users WHERE is_active),
			(SELECT COUNT(*) FROM users WHERE is_active AND created_at > NOW() - INTERVAL '7 days'),
			(SELECT COUNT(*) FROM giving_transactions WHERE status = 'awaiting_verification'),
			(SELECT COALESCE(SUM(amount), 0) FROM giving_transactions WHERE status = 'awaiting_verification'),
			(SELECT COALESCE(SUM(amount), 0) FROM giving_transactions WHERE status = 'success' AND created_at >= date_trunc('month', NOW())),
			(SELECT COUNT(*) FROM library_items WHERE is_published),
			(SELECT COUNT(*) FROM giving_transactions WHERE status = 'success' AND item_id <> '' AND created_at >= date_trunc('month', NOW())),
			(SELECT COUNT(*) FROM prayers WHERE status = 'new'),
			(SELECT COUNT(*) FROM community_messages WHERE created_at >= date_trunc('day', NOW())),
			COALESCE((SELECT title FROM live_sessions WHERE status IN ('live', 'starting') ORDER BY created_at DESC LIMIT 1), ''),
			COALESCE((SELECT status FROM live_sessions WHERE status IN ('live', 'starting') ORDER BY created_at DESC LIMIT 1), '')
		`).Scan(&o.Members, &o.NewMembersWeek, &o.PendingPayments, &o.PendingAmount, &o.GivenThisMonth, &o.Books, &o.BookSalesMonth,
			&o.NewPrayers, &o.ChatToday, &o.LiveTitle, &o.LiveStatus)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load the overview"})
			return
		}
		c.JSON(http.StatusOK, o)
	}
}
