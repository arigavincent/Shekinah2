package community

import (
	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/gin-gonic/gin"
	"strings"
)

func (h Handler) Report(c *gin.Context) {
	user, _ := auth.UserIDFromContext(c)
	var req struct {
		Reason string `json:"reason"`
	}
	if c.ShouldBindJSON(&req) != nil || len(strings.TrimSpace(req.Reason)) < 3 || len(req.Reason) > 500 {
		c.JSON(400, gin.H{"message": "Give a reason between 3 and 500 characters"})
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), `INSERT INTO community_reports(message_id,reporter_id,reason) SELECT id,$2,$3 FROM community_messages WHERE id=$1 AND status='approved' ON CONFLICT(message_id,reporter_id) DO NOTHING`, c.Param("id"), user, strings.TrimSpace(req.Reason))
	if err != nil {
		c.JSON(500, gin.H{"message": "Could not submit report"})
		return
	}
	c.JSON(200, gin.H{"ok": true, "recorded": tag.RowsAffected() > 0})
}
func (h Handler) Reports(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `SELECT r.id,r.message_id,r.reason,r.status,m.display_name,m.message FROM community_reports r JOIN community_messages m ON m.id=r.message_id WHERE r.status='new' ORDER BY r.created_at LIMIT 200`)
	if err != nil {
		c.JSON(500, gin.H{"message": "Could not load reports"})
		return
	}
	defer rows.Close()
	items := []gin.H{}
	for rows.Next() {
		var id int64
		var messageID, reason, status, name, message string
		if err := rows.Scan(&id, &messageID, &reason, &status, &name, &message); err != nil {
			c.JSON(500, gin.H{"message": "Could not read reports"})
			return
		}
		items = append(items, gin.H{"id": id, "messageId": messageID, "reason": reason, "status": status, "name": name, "message": message})
	}
	c.JSON(200, gin.H{"reports": items})
}
func (h Handler) ResolveReport(c *gin.Context) {
	_, err := h.db.Exec(c.Request.Context(), `UPDATE community_reports SET status='resolved' WHERE id=$1`, c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"message": "Could not resolve report"})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}
