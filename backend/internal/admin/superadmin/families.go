package superadmin

import (
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

// Family units: households linking members (head, spouse, child, other).

func (h *Handler) ListFamilies(c *gin.Context) {
	families, err := h.rows(c.Request.Context(), `SELECT f.id::text AS id,f.name,f.address,f.notes,
		COALESCE((SELECT json_agg(json_build_object('id',u.id::text,'name',u.name,'email',u.email,'familyRole',u.family_role) ORDER BY
			CASE u.family_role WHEN 'head' THEN 0 WHEN 'spouse' THEN 1 WHEN 'child' THEN 2 ELSE 3 END, u.name)
			FROM users u WHERE u.family_id=f.id AND u.deleted_at IS NULL),'[]'::json) AS members
		FROM family_units f ORDER BY f.name`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load families")
		return
	}
	c.JSON(http.StatusOK, gin.H{"families": families})
}

func (h *Handler) SaveFamily(c *gin.Context) {
	var req struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Address string `json:"address"`
		Notes   string `json:"notes"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" {
		fail(c, http.StatusBadRequest, "Name the family, e.g. The Otieno family")
		return
	}
	var id string
	err := h.db.QueryRow(c.Request.Context(), `INSERT INTO family_units(id,name,address,notes) VALUES(COALESCE(NULLIF($1,'')::uuid,gen_random_uuid()),$2,$3,$4)
		ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,notes=EXCLUDED.notes,updated_at=NOW() RETURNING id::text`,
		req.ID, strings.TrimSpace(req.Name), strings.TrimSpace(req.Address), strings.TrimSpace(req.Notes)).Scan(&id)
	if err != nil {
		fail(c, http.StatusBadRequest, "Could not save the family")
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Family saved"})
}

func (h *Handler) DeleteFamily(c *gin.Context) {
	ctx := c.Request.Context()
	_, _ = h.db.Exec(ctx, `UPDATE users SET family_id=NULL WHERE family_id::text=$1`, c.Param("id"))
	tag, err := h.db.Exec(ctx, `DELETE FROM family_units WHERE id::text=$1`, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Family not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Family removed; its members are kept"})
}

// SetFamily links a member to a family with a role, or unlinks with an empty familyId.
func (h *Handler) SetFamily(c *gin.Context) {
	var req struct {
		FamilyID   string `json:"familyId"`
		FamilyRole string `json:"familyRole"`
	}
	if c.ShouldBindJSON(&req) != nil {
		fail(c, http.StatusBadRequest, "Invalid family")
		return
	}
	role := cmpOr(req.FamilyRole, "other")
	if !slices.Contains([]string{"head", "spouse", "child", "other"}, role) {
		fail(c, http.StatusBadRequest, "Family role must be head, spouse, child or other")
		return
	}
	ctx := c.Request.Context()
	if req.FamilyID != "" {
		var ok bool
		if h.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM family_units WHERE id::text=$1)`, req.FamilyID).Scan(&ok) != nil || !ok {
			fail(c, http.StatusNotFound, "Family not found")
			return
		}
	}
	tag, err := h.db.Exec(ctx, `UPDATE users SET family_id=NULLIF($2,'')::uuid,family_role=$3,updated_at=NOW() WHERE id::text=$1 AND deleted_at IS NULL`, c.Param("id"), req.FamilyID, role)
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Member not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Family updated"})
}
