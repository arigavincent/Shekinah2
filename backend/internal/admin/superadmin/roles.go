package superadmin

import (
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/ariga/shekinah-backend/internal/permissions"
	"github.com/gin-gonic/gin"
)

// Role designer: named sets of permissions that can be given to people.

func (h *Handler) ListRoles(c *gin.Context) {
	roles, err := h.rows(c.Request.Context(), `SELECT r.id,r.name,r.description,r.permissions,(SELECT COUNT(*) FROM users u WHERE u.staff_role_id=r.id AND u.deleted_at IS NULL) AS holders,r.updated_at AS "updatedAt"
		FROM staff_roles r ORDER BY r.name`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load roles")
		return
	}
	c.JSON(http.StatusOK, gin.H{"roles": roles, "available": permissions.All})
}

func cleanPermissions(in []string) ([]string, bool) {
	out := []string{}
	for _, p := range in {
		if !slices.Contains(permissions.All, p) {
			return nil, false
		}
		if !slices.Contains(out, p) {
			out = append(out, p)
		}
	}
	return out, true
}

func (h *Handler) SaveRole(c *gin.Context) {
	var req struct {
		ID          string   `json:"id"`
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Permissions []string `json:"permissions"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" {
		fail(c, http.StatusBadRequest, "Name the role")
		return
	}
	perms, ok := cleanPermissions(req.Permissions)
	if !ok {
		fail(c, http.StatusBadRequest, "Unknown permission")
		return
	}
	id := cmpOr(req.ID, randomID("role"))
	_, err := h.db.Exec(c.Request.Context(), `INSERT INTO staff_roles(id,name,description,permissions) VALUES($1,$2,$3,$4)
		ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,permissions=EXCLUDED.permissions,updated_at=NOW()`,
		id, strings.TrimSpace(req.Name), strings.TrimSpace(req.Description), perms)
	if uniqueViolation(err) {
		fail(c, http.StatusConflict, "Another role already has this name")
		return
	} else if err != nil {
		fail(c, http.StatusInternalServerError, "Could not save the role")
		return
	}
	h.audit(c, "ROLE_SAVED", fmt.Sprintf("Role %s: %s", strings.TrimSpace(req.Name), strings.Join(perms, ", ")), id)
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Role saved; everyone with it has these permissions now"})
}

func (h *Handler) DuplicateRole(c *gin.Context) {
	id := randomID("role")
	var name string
	err := h.db.QueryRow(c.Request.Context(), `INSERT INTO staff_roles(id,name,description,permissions)
		SELECT $2, name||' (copy '||substr($2,6,4)||')', description, permissions FROM staff_roles WHERE id=$1 RETURNING name`, c.Param("id"), id).Scan(&name)
	if err != nil {
		fail(c, http.StatusNotFound, "Role not found")
		return
	}
	h.audit(c, "ROLE_DUPLICATED", "Duplicated role as "+name, id)
	c.JSON(http.StatusCreated, gin.H{"id": id, "name": name, "message": "Role duplicated"})
}

func (h *Handler) DeleteRole(c *gin.Context) {
	var name string
	if h.db.QueryRow(c.Request.Context(), `DELETE FROM staff_roles WHERE id=$1 RETURNING name`, c.Param("id")).Scan(&name) != nil {
		fail(c, http.StatusNotFound, "Role not found")
		return
	}
	h.audit(c, "ROLE_DELETED", "Deleted role "+name+"; holders keep only individual permissions", c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Role deleted; people who had it keep only their individual permissions"})
}

// AssignRole gives a person a role, or removes it with an empty roleId.
func (h *Handler) AssignRole(c *gin.Context) {
	var req struct {
		RoleID string `json:"roleId"`
	}
	if c.ShouldBindJSON(&req) != nil {
		fail(c, http.StatusBadRequest, "Invalid role")
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE users SET staff_role_id=NULLIF($2,''),updated_at=NOW() WHERE id::text=$1 AND deleted_at IS NULL`, c.Param("id"), req.RoleID)
	if err != nil {
		fail(c, http.StatusBadRequest, "Role not found")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Account not found")
		return
	}
	h.audit(c, "ROLE_ASSIGNED", "Role set to "+cmpOr(req.RoleID, "none"), c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Role updated"})
}
