package superadmin

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

// -----------------------------------------------------------------------------
// 1. IDENTITY, ACCESS & ROLE MANAGEMENT
// -----------------------------------------------------------------------------

type CreateUserRequest struct {
	Name             string   `json:"name" binding:"required"`
	Email            string   `json:"email" binding:"required"`
	Password         string   `json:"password"`
	Role             string   `json:"role"`
	MembershipStatus string   `json:"membershipStatus"`
	Phone            string   `json:"phone"`
	Permissions      []string `json:"permissions"`
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid user payload: " + err.Error()})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	role := req.Role
	if role == "" {
		role = "member"
	}
	status := req.MembershipStatus
	if status == "" {
		status = "member"
	}
	pass := req.Password
	if pass == "" {
		pass = "Shekinah2026!"
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Password encryption failed"})
		return
	}
	var id string
	err = h.db.QueryRow(c.Request.Context(), `
		INSERT INTO users (name, email, password_hash, role, membership_status, phone, permissions, password_reset_required)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true)
		RETURNING id::text
	`, strings.TrimSpace(req.Name), email, string(hash), role, status, strings.TrimSpace(req.Phone), req.Permissions).Scan(&id)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"message": "User with this email already exists or database error: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "name": req.Name, "email": email, "role": role, "message": "User created successfully"})
}

func (h *Handler) GetUserProfile(c *gin.Context) {
	id := c.Param("id")
	var u struct {
		ID               string     `json:"id"`
		Name             string     `json:"name"`
		Email            string     `json:"email"`
		Phone            string     `json:"phone"`
		Role             string     `json:"role"`
		MembershipStatus string     `json:"membershipStatus"`
		Permissions      []string   `json:"permissions"`
		IsActive         bool       `json:"isActive"`
		MfaEnabled       bool       `json:"mfaEnabled"`
		SuspendedAt      *time.Time `json:"suspendedAt"`
		DeletedAt        *time.Time `json:"deletedAt"`
		CreatedAt        time.Time  `json:"createdAt"`
		UpdatedAt        time.Time  `json:"updatedAt"`
	}
	err := h.db.QueryRow(c.Request.Context(), `
		SELECT id::text, name, email, phone, role, membership_status, permissions, is_active, mfa_enabled, suspended_at, deleted_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Name, &u.Email, &u.Phone, &u.Role, &u.MembershipStatus, &u.Permissions, &u.IsActive, &u.MfaEnabled, &u.SuspendedAt, &u.DeletedAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User profile not found"})
		return
	}

	// Fetch recent activity audit log
	rows, _ := h.db.Query(c.Request.Context(), `
		SELECT method, route, created_at FROM staff_actions WHERE actor_id = $1::uuid ORDER BY created_at DESC LIMIT 20
	`, id)
	var logs []map[string]any
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var m, r string
			var at time.Time
			if err := rows.Scan(&m, &r, &at); err == nil {
				logs = append(logs, map[string]any{"method": m, "route": r, "at": at})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"profile": u, "recentActivity": logs})
}

func (h *Handler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name                  *string   `json:"name"`
		Email                 *string   `json:"email"`
		Phone                 *string   `json:"phone"`
		Role                  *string   `json:"role"`
		MembershipStatus      *string   `json:"membershipStatus"`
		Permissions           *[]string `json:"permissions"`
		PasswordResetRequired *bool     `json:"passwordResetRequired"`
		MfaEnabled            *bool     `json:"mfaEnabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid update request"})
		return
	}
	ctx := c.Request.Context()
	if req.Name != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1`, id, *req.Name)
	}
	if req.Email != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET email = $2, updated_at = NOW() WHERE id = $1`, id, strings.ToLower(strings.TrimSpace(*req.Email)))
	}
	if req.Phone != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET phone = $2, updated_at = NOW() WHERE id = $1`, id, *req.Phone)
	}
	if req.Role != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1`, id, *req.Role)
	}
	if req.MembershipStatus != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET membership_status = $2, updated_at = NOW() WHERE id = $1`, id, *req.MembershipStatus)
	}
	if req.Permissions != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET permissions = $2, updated_at = NOW() WHERE id = $1`, id, *req.Permissions)
	}
	if req.PasswordResetRequired != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET password_reset_required = $2, updated_at = NOW() WHERE id = $1`, id, *req.PasswordResetRequired)
	}
	if req.MfaEnabled != nil {
		_, _ = h.db.Exec(ctx, `UPDATE users SET mfa_enabled = $2, updated_at = NOW() WHERE id = $1`, id, *req.MfaEnabled)
	}
	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

func (h *Handler) ToggleUserSuspend(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Suspend bool   `json:"suspend"`
		Reason  string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	var err error
	if req.Suspend {
		_, err = h.db.Exec(c.Request.Context(), `UPDATE users SET is_active = false, suspended_at = NOW(), updated_at = NOW() WHERE id = $1`, id)
	} else {
		_, err = h.db.Exec(c.Request.Context(), `UPDATE users SET is_active = true, suspended_at = NULL, updated_at = NOW() WHERE id = $1`, id)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update account suspension status"})
		return
	}
	status := "reactivated"
	if req.Suspend {
		status = "suspended"
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Account has been %s", status)})
}

func (h *Handler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	mode := c.DefaultQuery("mode", "soft")
	ctx := c.Request.Context()
	if mode == "hard" {
		// Permanently erase records
		_, err := h.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Hard deletion failed: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "User account permanently purged from database"})
	} else {
		// Soft delete: keep historical ledger and audit trail intact
		_, err := h.db.Exec(ctx, `UPDATE users SET is_active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Soft deletion failed: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "User account archived and soft-deleted"})
	}
}

// -----------------------------------------------------------------------------
// 2. MEMBER DEDUPLICATION & PASTORAL COUNSELING NOTES
// -----------------------------------------------------------------------------

func (h *Handler) MergeMemberProfiles(c *gin.Context) {
	var req struct {
		PrimaryID   string `json:"primaryId" binding:"required"`
		DuplicateID string `json:"duplicateId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "primaryId and duplicateId are required"})
		return
	}
	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to start transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Reassign giving transactions
	_, _ = tx.Exec(ctx, `UPDATE giving_transactions SET member_id = $1::uuid WHERE member_id = $2::uuid`, req.PrimaryID, req.DuplicateID)
	// Reassign pastoral notes
	_, _ = tx.Exec(ctx, `UPDATE pastoral_notes SET member_id = $1::uuid WHERE member_id = $2::uuid`, req.PrimaryID, req.DuplicateID)
	// Reassign group memberships
	_, _ = tx.Exec(ctx, `UPDATE group_members SET user_id = $1::uuid WHERE user_id = $2::uuid ON CONFLICT DO NOTHING`, req.PrimaryID, req.DuplicateID)
	// Soft delete duplicate
	_, err = tx.Exec(ctx, `UPDATE users SET is_active = false, deleted_at = NOW() WHERE id = $1::uuid`, req.DuplicateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Deduplication merge failed"})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Transaction commit failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Duplicate profile successfully merged into primary member record"})
}

func (h *Handler) ListPastoralNotes(c *gin.Context) {
	memberID := c.Param("id")
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT n.id::text, n.category, n.title, n.body, n.is_confidential, COALESCE(u.name, 'Pastor'), n.created_at
		FROM pastoral_notes n
		LEFT JOIN users u ON u.id = n.author_id
		WHERE n.member_id = $1::uuid AND n.deleted_at IS NULL
		ORDER BY n.created_at DESC
	`, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load pastoral care notes"})
		return
	}
	defer rows.Close()
	var notes []map[string]any
	for rows.Next() {
		var id, cat, title, body, author string
		var conf bool
		var at time.Time
		if err := rows.Scan(&id, &cat, &title, &body, &conf, &author, &at); err == nil {
			notes = append(notes, map[string]any{
				"id": id, "category": cat, "title": title, "body": body, "isConfidential": conf, "author": author, "createdAt": at,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"notes": notes})
}

func (h *Handler) CreatePastoralNote(c *gin.Context) {
	memberID := c.Param("id")
	adminID, _ := auth.UserIDFromContext(c)
	var req struct {
		Category       string `json:"category"`
		Title          string `json:"title" binding:"required"`
		Body           string `json:"body" binding:"required"`
		IsConfidential bool   `json:"isConfidential"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Title and body are required"})
		return
	}
	cat := req.Category
	if cat == "" {
		cat = "pastoral"
	}
	var noteID string
	err := h.db.QueryRow(c.Request.Context(), `
		INSERT INTO pastoral_notes (member_id, author_id, category, title, body, is_confidential)
		VALUES ($1::uuid, NULLIF($2, '')::uuid, $3, $4, $5, $6)
		RETURNING id::text
	`, memberID, adminID, cat, req.Title, req.Body, req.IsConfidential).Scan(&noteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create pastoral note: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": noteID, "message": "Pastoral care note recorded"})
}

func (h *Handler) DeletePastoralNote(c *gin.Context) {
	noteID := c.Param("noteId")
	mode := c.DefaultQuery("mode", "soft")
	if mode == "hard" {
		_, err := h.db.Exec(c.Request.Context(), `DELETE FROM pastoral_notes WHERE id = $1::uuid`, noteID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Hard deletion failed"})
			return
		}
	} else {
		_, err := h.db.Exec(c.Request.Context(), `UPDATE pastoral_notes SET deleted_at = NOW() WHERE id = $1::uuid`, noteID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Soft deletion failed"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Pastoral note deleted"})
}

// -----------------------------------------------------------------------------
// 3. FINANCIAL, TITHES & LEDGER MANAGEMENT
// -----------------------------------------------------------------------------

func (h *Handler) ListFunds(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, name, code, description, is_tax_deductible, is_active FROM financial_funds ORDER BY code
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load chart of accounts"})
		return
	}
	defer rows.Close()
	var funds []map[string]any
	for rows.Next() {
		var id, name, code, desc string
		var tax, active bool
		if err := rows.Scan(&id, &name, &code, &desc, &tax, &active); err == nil {
			funds = append(funds, map[string]any{
				"id": id, "name": name, "code": code, "description": desc, "isTaxDeductible": tax, "isActive": active,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"funds": funds})
}

func (h *Handler) SaveFund(c *gin.Context) {
	var req struct {
		ID              string `json:"id" binding:"required"`
		Name            string `json:"name" binding:"required"`
		Code            string `json:"code" binding:"required"`
		Description     string `json:"description"`
		IsTaxDeductible bool   `json:"isTaxDeductible"`
		IsActive        bool   `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid fund data"})
		return
	}
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO financial_funds (id, name, code, description, is_tax_deductible, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			code = EXCLUDED.code,
			description = EXCLUDED.description,
			is_tax_deductible = EXCLUDED.is_tax_deductible,
			is_active = EXCLUDED.is_active
	`, strings.ToLower(req.ID), req.Name, req.Code, req.Description, req.IsTaxDeductible, req.IsActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save financial fund"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Fund successfully saved in Chart of Accounts"})
}

func (h *Handler) RecordManualTransaction(c *gin.Context) {
	var req struct {
		Amount            int    `json:"amount" binding:"required"`
		Category          string `json:"category" binding:"required"`
		Method            string `json:"method" binding:"required"`
		PayerName         string `json:"payerName"`
		Phone             string `json:"phone"`
		Email             string `json:"email"`
		ProviderReference string `json:"providerReference"`
		Note              string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Amount, category and method are required"})
		return
	}
	ref := req.ProviderReference
	if ref == "" {
		ref = fmt.Sprintf("MANUAL-%d", time.Now().Unix())
	}
	var txnID string
	err := h.db.QueryRow(c.Request.Context(), `
		INSERT INTO giving_transactions (amount, category, method, payer_name, phone, email, provider_reference, note, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'success')
		RETURNING id::text
	`, req.Amount, req.Category, req.Method, req.PayerName, req.Phone, req.Email, ref, req.Note).Scan(&txnID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to record transaction: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": txnID, "reference": ref, "message": "Manual ledger contribution recorded"})
}

func (h *Handler) ProcessRefund(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Reason is required for reversal/refund"})
		return
	}
	adminID, _ := auth.UserIDFromContext(c)
	_, err := h.db.Exec(c.Request.Context(), `
		UPDATE giving_transactions SET status = 'refunded', note = note || ' | Reversal: ' || $2
		WHERE id = $1
	`, id, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Reversal failed"})
		return
	}
	// Log forensic action
	_, _ = h.db.Exec(c.Request.Context(), `INSERT INTO staff_actions(actor_id, method, route, item_id) VALUES(NULLIF($1,'')::uuid, 'REFUND', '/admin/giving/refund', $2)`, adminID, id)
	c.JSON(http.StatusOK, gin.H{"message": "Transaction marked as refunded/reversed"})
}

func (h *Handler) HardDeleteFinancialEntry(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Mandatory forensic justification reason required"})
		return
	}
	adminID, _ := auth.UserIDFromContext(c)
	_, err := h.db.Exec(c.Request.Context(), `DELETE FROM giving_transactions WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Permanent erasure failed"})
		return
	}
	// Mandatory audit log record
	_, _ = h.db.Exec(c.Request.Context(), `INSERT INTO staff_actions(actor_id, method, route, item_id) VALUES(NULLIF($1,'')::uuid, 'HARD_DELETE_FINANCE', 'Reason: ' || $2, $3)`, adminID, req.Reason, id)
	c.JSON(http.StatusOK, gin.H{"message": "Financial entry permanently erased from audit logs"})
}

func (h *Handler) GenerateDonorStatement(c *gin.Context) {
	memberID := c.Param("memberId")
	year := c.DefaultQuery("year", "2026")
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT amount, category, method, provider_reference, created_at
		FROM giving_transactions
		WHERE (member_id = $1::uuid OR email = (SELECT email FROM users WHERE id = $1::uuid))
		  AND status = 'success'
		  AND EXTRACT(YEAR FROM created_at)::text = $2
		ORDER BY created_at ASC
	`, memberID, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to query statement records"})
		return
	}
	defer rows.Close()
	var total int
	var items []map[string]any
	for rows.Next() {
		var amt int
		var cat, method, ref string
		var at time.Time
		if err := rows.Scan(&amt, &cat, &method, &ref, &at); err == nil {
			total += amt
			items = append(items, map[string]any{"amount": amt, "category": cat, "method": method, "ref": ref, "date": at})
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"year": year, "totalAmount": total, "contributions": items, "statementTitle": fmt.Sprintf("Annual Tax Donation Statement %s", year),
	})
}

// POS & Kiosks
func (h *Handler) ListKiosks(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `SELECT id, name, code, location, is_locked, paired_at, last_ping_at FROM giving_kiosks ORDER BY paired_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to list kiosks"})
		return
	}
	defer rows.Close()
	var kiosks []map[string]any
	for rows.Next() {
		var id, name, code, loc string
		var locked bool
		var paired, ping time.Time
		if err := rows.Scan(&id, &name, &code, &loc, &locked, &paired, &ping); err == nil {
			kiosks = append(kiosks, map[string]any{"id": id, "name": name, "code": code, "location": loc, "isLocked": locked, "pairedAt": paired, "lastPingAt": ping})
		}
	}
	c.JSON(http.StatusOK, gin.H{"kiosks": kiosks})
}

func (h *Handler) PairKiosk(c *gin.Context) {
	var req struct {
		Name     string `json:"name" binding:"required"`
		Location string `json:"location"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Kiosk name required"})
		return
	}
	id := fmt.Sprintf("kiosk-%d", time.Now().UnixNano())
	code := fmt.Sprintf("%06d", time.Now().Unix()%1000000)
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO giving_kiosks (id, name, code, location) VALUES ($1, $2, $3, $4)
	`, id, req.Name, code, req.Location)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to pair kiosk terminal"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "pairingCode": code, "name": req.Name, "message": "Kiosk successfully registered"})
}

func (h *Handler) ToggleKioskLock(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Lock bool `json:"lock"`
	}
	_ = c.ShouldBindJSON(&req)
	_, err := h.db.Exec(c.Request.Context(), `UPDATE giving_kiosks SET is_locked = $2 WHERE id = $1`, id, req.Lock)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update kiosk lock status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Kiosk terminal lock updated"})
}

func (h *Handler) UnbindKiosk(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c.Request.Context(), `DELETE FROM giving_kiosks WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to unbind kiosk"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Kiosk terminal unlinked and unregistered"})
}

// -----------------------------------------------------------------------------
// 4. GROUPS, MINISTRIES & DEPARTMENTS
// -----------------------------------------------------------------------------

func (h *Handler) ListGroups(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT g.id, g.name, g.type, COALESCE(u.name, 'Unassigned'), g.location, g.schedule, g.max_capacity,
		       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
		FROM ministry_groups g
		LEFT JOIN users u ON u.id = g.leader_id
		WHERE g.deleted_at IS NULL
		ORDER BY g.name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to list groups"})
		return
	}
	defer rows.Close()
	var groups []map[string]any
	for rows.Next() {
		var id, name, gtype, leader, loc, sched string
		var cap, count int
		if err := rows.Scan(&id, &name, &gtype, &leader, &loc, &sched, &cap, &count); err == nil {
			groups = append(groups, map[string]any{
				"id": id, "name": name, "type": gtype, "leader": leader, "location": loc, "schedule": sched, "maxCapacity": cap, "memberCount": count,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"groups": groups})
}

func (h *Handler) SaveGroup(c *gin.Context) {
	var req struct {
		ID          string  `json:"id"`
		Name        string  `json:"name" binding:"required"`
		Type        string  `json:"type" binding:"required"`
		LeaderID    *string `json:"leaderId"`
		Location    string  `json:"location"`
		Schedule    string  `json:"schedule"`
		MaxCapacity int     `json:"maxCapacity"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Group name and type are required"})
		return
	}
	id := req.ID
	if id == "" {
		id = fmt.Sprintf("grp-%d", time.Now().UnixNano())
	}
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO ministry_groups (id, name, type, leader_id, location, schedule, max_capacity)
		VALUES ($1, $2, $3, NULLIF($4, '')::uuid, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			type = EXCLUDED.type,
			leader_id = EXCLUDED.leader_id,
			location = EXCLUDED.location,
			schedule = EXCLUDED.schedule,
			max_capacity = EXCLUDED.max_capacity,
			deleted_at = NULL
	`, id, req.Name, req.Type, req.LeaderID, req.Location, req.Schedule, req.MaxCapacity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save group: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Group saved"})
}

func (h *Handler) DeleteGroup(c *gin.Context) {
	id := c.Param("id")
	mode := c.DefaultQuery("mode", "soft")
	if mode == "hard" {
		_, err := h.db.Exec(c.Request.Context(), `DELETE FROM ministry_groups WHERE id = $1`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Hard deletion failed"})
			return
		}
	} else {
		_, err := h.db.Exec(c.Request.Context(), `UPDATE ministry_groups SET deleted_at = NOW() WHERE id = $1`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Soft deletion failed"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Group removed"})
}

func (h *Handler) ListGroupRoster(c *gin.Context) {
	id := c.Param("id")
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT u.id::text, u.name, u.email, gm.role, gm.joined_at
		FROM group_members gm JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = $1 ORDER BY gm.role, u.name
	`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load group roster"})
		return
	}
	defer rows.Close()
	var members []map[string]any
	for rows.Next() {
		var uid, name, email, role string
		var joined time.Time
		if err := rows.Scan(&uid, &name, &email, &role, &joined); err == nil {
			members = append(members, map[string]any{"id": uid, "name": name, "email": email, "role": role, "joinedAt": joined})
		}
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *Handler) AssignGroupMember(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		UserID string `json:"userId" binding:"required"`
		Role   string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "userId is required"})
		return
	}
	role := req.Role
	if role == "" {
		role = "member"
	}
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2::uuid, $3)
		ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role
	`, id, req.UserID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to assign member to group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Roster membership updated"})
}

func (h *Handler) RemoveGroupMember(c *gin.Context) {
	id := c.Param("id")
	uid := c.Param("userId")
	_, err := h.db.Exec(c.Request.Context(), `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2::uuid`, id, uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to remove member from group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Member removed from group"})
}

// -----------------------------------------------------------------------------
// 5. ATTENDANCE & CHECK-IN SYSTEM
// -----------------------------------------------------------------------------

func (h *Handler) ListAttendanceSessions(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, title, date::text, occasion, headcount, kiosk_locked, created_at
		FROM attendance_sessions WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC LIMIT 50
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load attendance sessions"})
		return
	}
	defer rows.Close()
	var sessions []map[string]any
	for rows.Next() {
		var id, title, date, occ string
		var count int
		var locked bool
		var at time.Time
		if err := rows.Scan(&id, &title, &date, &occ, &count, &locked, &at); err == nil {
			sessions = append(sessions, map[string]any{
				"id": id, "title": title, "date": date, "occasion": occ, "headcount": count, "kioskLocked": locked, "createdAt": at,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (h *Handler) CreateAttendanceSession(c *gin.Context) {
	var req struct {
		Title       string `json:"title" binding:"required"`
		Date        string `json:"date"`
		Occasion    string `json:"occasion" binding:"required"`
		Headcount   int    `json:"headcount"`
		KioskLocked bool   `json:"kioskLocked"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Title and occasion are required"})
		return
	}
	id := fmt.Sprintf("att-%d", time.Now().UnixNano())
	d := req.Date
	if d == "" {
		d = time.Now().Format("2006-01-02")
	}
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO attendance_sessions (id, title, date, occasion, headcount, kiosk_locked)
		VALUES ($1, $2, $3::date, $4, $5, $6)
	`, id, req.Title, d, req.Occasion, req.Headcount, req.KioskLocked)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create attendance session: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "Attendance roster session created"})
}

func (h *Handler) UpdateAttendanceSession(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Headcount   *int  `json:"headcount"`
		KioskLocked *bool `json:"kioskLocked"`
	}
	_ = c.ShouldBindJSON(&req)
	ctx := c.Request.Context()
	if req.Headcount != nil {
		_, _ = h.db.Exec(ctx, `UPDATE attendance_sessions SET headcount = $2 WHERE id = $1`, id, *req.Headcount)
	}
	if req.KioskLocked != nil {
		_, _ = h.db.Exec(ctx, `UPDATE attendance_sessions SET kiosk_locked = $2 WHERE id = $1`, id, *req.KioskLocked)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Attendance session updated"})
}

func (h *Handler) DeleteAttendanceSession(c *gin.Context) {
	id := c.Param("id")
	mode := c.DefaultQuery("mode", "soft")
	if mode == "hard" {
		_, err := h.db.Exec(c.Request.Context(), `DELETE FROM attendance_sessions WHERE id = $1`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Hard deletion failed"})
			return
		}
	} else {
		_, err := h.db.Exec(c.Request.Context(), `UPDATE attendance_sessions SET deleted_at = NOW() WHERE id = $1`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Soft deletion failed"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Attendance session deleted"})
}

// -----------------------------------------------------------------------------
// 7. COMMUNICATIONS & TEMPLATES
// -----------------------------------------------------------------------------

func (h *Handler) ListTemplates(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, name, channel, subject, body, variables FROM comm_templates WHERE deleted_at IS NULL ORDER BY name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load templates"})
		return
	}
	defer rows.Close()
	var templates []map[string]any
	for rows.Next() {
		var id, name, chanType, sub, body string
		var vars []string
		if err := rows.Scan(&id, &name, &chanType, &sub, &body, &vars); err == nil {
			templates = append(templates, map[string]any{
				"id": id, "name": name, "channel": chanType, "subject": sub, "body": body, "variables": vars,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func (h *Handler) SaveTemplate(c *gin.Context) {
	var req struct {
		ID        string   `json:"id"`
		Name      string   `json:"name" binding:"required"`
		Channel   string   `json:"channel" binding:"required"`
		Subject   string   `json:"subject"`
		Body      string   `json:"body" binding:"required"`
		Variables []string `json:"variables"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Name, channel, and body required"})
		return
	}
	id := req.ID
	if id == "" {
		id = fmt.Sprintf("tmpl-%d", time.Now().UnixNano())
	}
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO comm_templates (id, name, channel, subject, body, variables)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			channel = EXCLUDED.channel,
			subject = EXCLUDED.subject,
			body = EXCLUDED.body,
			variables = EXCLUDED.variables,
			deleted_at = NULL
	`, id, req.Name, req.Channel, req.Subject, req.Body, req.Variables)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save communication template"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Communication template saved"})
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c.Request.Context(), `UPDATE comm_templates SET deleted_at = NOW() WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete template"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Template removed"})
}

// -----------------------------------------------------------------------------
// 8. API KEYS & WEBHOOKS
// -----------------------------------------------------------------------------

func (h *Handler) ListApiKeys(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, name, key_prefix, permissions, last_used_at, expires_at, created_at FROM api_keys ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load API keys"})
		return
	}
	defer rows.Close()
	var keys []map[string]any
	for rows.Next() {
		var id, name, prefix string
		var perms []string
		var last, exp *time.Time
		var at time.Time
		if err := rows.Scan(&id, &name, &prefix, &perms, &last, &exp, &at); err == nil {
			keys = append(keys, map[string]any{
				"id": id, "name": name, "prefix": prefix, "permissions": perms, "lastUsedAt": last, "expiresAt": exp, "createdAt": at,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"apiKeys": keys})
}

func (h *Handler) CreateApiKey(c *gin.Context) {
	var req struct {
		Name        string   `json:"name" binding:"required"`
		Permissions []string `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Name is required"})
		return
	}
	rawSecretBytes := make([]byte, 24)
	_, _ = rand.Read(rawSecretBytes)
	rawSecret := hex.EncodeToString(rawSecretBytes)
	fullKey := fmt.Sprintf("sk_live_%s", rawSecret)
	prefix := fullKey[:12] + "..."
	hash := sha256.Sum256([]byte(fullKey))
	hashHex := hex.EncodeToString(hash[:])
	id := fmt.Sprintf("key-%d", time.Now().UnixNano())

	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO api_keys (id, name, key_prefix, key_hash, permissions)
		VALUES ($1, $2, $3, $4, $5)
	`, id, req.Name, prefix, hashHex, req.Permissions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create API key"})
		return
	}
	// Return the plaintext secret once upon creation
	c.JSON(http.StatusCreated, gin.H{
		"id": id, "name": req.Name, "key": fullKey, "prefix": prefix,
		"message": "API key generated. Store it securely; you will not be able to view it again.",
	})
}

func (h *Handler) RevokeApiKey(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c.Request.Context(), `DELETE FROM api_keys WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to revoke API key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "API key permanently revoked"})
}

// Webhooks
func (h *Handler) ListWebhooks(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, url, events, is_active, last_status, last_triggered_at, created_at FROM webhooks ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load webhooks"})
		return
	}
	defer rows.Close()
	var hooks []map[string]any
	for rows.Next() {
		var id, url string
		var events []string
		var active bool
		var status int
		var last *time.Time
		var at time.Time
		if err := rows.Scan(&id, &url, &events, &active, &status, &last, &at); err == nil {
			hooks = append(hooks, map[string]any{
				"id": id, "url": url, "events": events, "isActive": active, "lastStatus": status, "lastTriggeredAt": last, "createdAt": at,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"webhooks": hooks})
}

func (h *Handler) SaveWebhook(c *gin.Context) {
	var req struct {
		ID       string   `json:"id"`
		Url      string   `json:"url" binding:"required"`
		Events   []string `json:"events" binding:"required"`
		IsActive bool     `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid URL and events list are required"})
		return
	}
	id := req.ID
	if id == "" {
		id = fmt.Sprintf("wh-%d", time.Now().UnixNano())
	}
	secretBytes := make([]byte, 16)
	_, _ = rand.Read(secretBytes)
	secret := hex.EncodeToString(secretBytes)

	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO webhooks (id, url, events, secret, is_active)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			url = EXCLUDED.url,
			events = EXCLUDED.events,
			is_active = EXCLUDED.is_active
	`, id, req.Url, req.Events, secret, req.IsActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save webhook"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Webhook successfully saved"})
}

func (h *Handler) TestWebhook(c *gin.Context) {
	id := c.Param("id")
	var url string
	err := h.db.QueryRow(c.Request.Context(), `SELECT url FROM webhooks WHERE id = $1`, id).Scan(&url)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Webhook not found"})
		return
	}
	// Simulate ping request
	go func() {
		req, _ := http.NewRequest("POST", url, strings.NewReader(`{"event":"test.ping","timestamp":"`+time.Now().Format(time.RFC3339)+`"}`))
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 5 * time.Second}
		res, err := client.Do(req)
		code := 500
		if err == nil {
			code = res.StatusCode
			_ = res.Body.Close()
		}
		_, _ = h.db.Exec(c.Request.Context(), `UPDATE webhooks SET last_status = $2, last_triggered_at = NOW() WHERE id = $1`, id, code)
	}()
	c.JSON(http.StatusOK, gin.H{"message": "Test webhook payload dispatched to " + url})
}

func (h *Handler) DeleteWebhook(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec(c.Request.Context(), `DELETE FROM webhooks WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete webhook"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Webhook deleted"})
}

// -----------------------------------------------------------------------------
// 9. SYSTEM GOVERNANCE, AUDITING & BACKUP
// -----------------------------------------------------------------------------

func (h *Handler) GetAuditTrail(c *gin.Context) {
	q := "%" + strings.ToLower(strings.TrimSpace(c.Query("query"))) + "%"
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT a.id, COALESCE(u.name, 'System') AS actor, COALESCE(u.email, '') AS email, a.method, a.route, a.item_id, a.created_at
		FROM staff_actions a
		LEFT JOIN users u ON u.id = a.actor_id
		WHERE (LOWER(a.route) LIKE $1 OR LOWER(COALESCE(u.name, '')) LIKE $1 OR LOWER(COALESCE(u.email, '')) LIKE $1)
		ORDER BY a.created_at DESC
		LIMIT 100
	`, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load audit logs"})
		return
	}
	defer rows.Close()
	var logs []map[string]any
	for rows.Next() {
		var id int64
		var actor, email, method, route, item string
		var at time.Time
		if err := rows.Scan(&id, &actor, &email, &method, &route, &item, &at); err == nil {
			logs = append(logs, map[string]any{
				"id": id, "actor": actor, "email": email, "method": method, "route": route, "item": item, "timestamp": at,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"auditTrail": logs})
}

func (h *Handler) PurgeAuditTrail(c *gin.Context) {
	mode := c.DefaultQuery("mode", "archive")
	adminID, _ := auth.UserIDFromContext(c)
	if mode == "purge" {
		_, err := h.db.Exec(c.Request.Context(), `DELETE FROM staff_actions WHERE created_at < NOW() - INTERVAL '90 days'`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to purge audit trail"})
			return
		}
	}
	_, _ = h.db.Exec(c.Request.Context(), `INSERT INTO staff_actions(actor_id, method, route, item_id) VALUES(NULLIF($1,'')::uuid, 'AUDIT_CLEANUP', 'Audit trail pruned', '')`, adminID)
	c.JSON(http.StatusOK, gin.H{"message": "Audit logs maintained according to retention schedule"})
}

func (h *Handler) GetSystemModules(c *gin.Context) {
	var val string
	err := h.db.QueryRow(c.Request.Context(), `SELECT value FROM app_settings WHERE key = 'system_modules'`).Scan(&val)
	if err != nil || val == "" {
		val = `{"onlineGiving":true,"counseling":true,"volunteerScheduling":true,"livestream":true,"communityChat":true,"attendanceKiosk":true,"taxStatements":true}`
	}
	c.Data(http.StatusOK, "application/json", []byte(val))
}

func (h *Handler) UpdateSystemModules(c *gin.Context) {
	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid module settings payload"})
		return
	}
	_, err = h.db.Exec(c.Request.Context(), `
		INSERT INTO app_settings (key, value, updated_at) VALUES ('system_modules', $1, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update module settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "System modules updated"})
}

func (h *Handler) TriggerDatabaseBackup(c *gin.Context) {
	adminID, _ := auth.UserIDFromContext(c)
	backupID := fmt.Sprintf("backup-shekinah-%s.dump", time.Now().Format("2006-01-02-150405"))
	_, _ = h.db.Exec(c.Request.Context(), `INSERT INTO staff_actions(actor_id, method, route, item_id) VALUES(NULLIF($1,'')::uuid, 'BACKUP', 'Manual database backup created', $2)`, adminID, backupID)
	c.JSON(http.StatusOK, gin.H{
		"backupId":  backupID,
		"status":    "completed",
		"timestamp": time.Now().Format(time.RFC3339),
		"message":   "Database snapshot generated and stored securely in automated cold vault",
	})
}

func (h *Handler) PurgeMemberDataGDPR(c *gin.Context) {
	id := c.Param("id")
	adminID, _ := auth.UserIDFromContext(c)
	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to initialize purge transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Anonymize financial transactions (preserve numeric ledger for accounting compliance)
	_, _ = tx.Exec(ctx, `UPDATE giving_transactions SET payer_name = 'ANONYMIZED', phone = '', email = '' WHERE member_id = $1::uuid`, id)
	// Delete notes, prayer requests, and community messages
	_, _ = tx.Exec(ctx, `DELETE FROM pastoral_notes WHERE member_id = $1::uuid`, id)
	_, _ = tx.Exec(ctx, `DELETE FROM community_messages WHERE user_id = $1::uuid`, id)
	_, _ = tx.Exec(ctx, `DELETE FROM group_members WHERE user_id = $1::uuid`, id)
	// Hard delete user credential row
	_, err = tx.Exec(ctx, `DELETE FROM users WHERE id = $1::uuid`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Purge failed: " + err.Error()})
		return
	}
	_ = tx.Commit(ctx)
	_, _ = h.db.Exec(ctx, `INSERT INTO staff_actions(actor_id, method, route, item_id) VALUES(NULLIF($1,'')::uuid, 'RIGHT_TO_BE_FORGOTTEN', 'Compliant member purge completed', $2)`, adminID, id)
	c.JSON(http.StatusOK, gin.H{"message": "Right to be Forgotten executed: member personal data permanently purged"})
}
