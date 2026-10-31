// Package superadmin holds the tools only a super admin may use: accounts,
// pastoral notes, finance corrections, groups, attendance, message templates,
// API keys, webhooks, feature switches, audit trail, backups and data erasure.
package superadmin

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/permissions"
	"github.com/ariga/shekinah-backend/internal/webhooks"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

// Only Super Admin pages reach these handlers (see RequireSuperAdmin).
func RequireSuperAdmin(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := auth.UserIDFromContext(c)
		if _, viaKey := auth.APIKeyPermissions(c); !ok || viaKey {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Super admin access required"})
			return
		}
		var role string
		_ = db.QueryRow(c.Request.Context(), `SELECT role FROM users WHERE id=$1 AND is_active`, user).Scan(&role)
		if role != "super_admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Super admin access required"})
			return
		}
		c.Next()
	}
}

// ---------------------------------------------------------------------------
// helpers

func fail(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, gin.H{"message": message})
}

func randomID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

// rows returns query results as JSON-ready maps keyed by the column aliases.
func (h *Handler) rows(ctx context.Context, sql string, args ...any) ([]map[string]any, error) {
	r, err := h.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(r, pgx.RowToMap)
	if out == nil {
		out = []map[string]any{}
	}
	return out, err
}

func (h *Handler) audit(c *gin.Context, action, detail, item string) {
	actor, _ := auth.UserIDFromContext(c)
	_, _ = h.db.Exec(context.Background(), `INSERT INTO staff_actions(actor_id,method,route,item_id) VALUES(NULLIF($1,'')::uuid,$2,$3,$4)`, actor, action, detail, item)
}

func uniqueViolation(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}

func (h *Handler) superAdminCount(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) int {
	var n int
	_ = q.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='super_admin' AND is_active AND deleted_at IS NULL`).Scan(&n)
	return n
}

// notSelf stops a super admin from suspending, deleting, merging or erasing
// their own account, which would lock them out of these tools.
func notSelf(c *gin.Context, id string) bool {
	me, _ := auth.UserIDFromContext(c)
	if me == id {
		fail(c, http.StatusBadRequest, "You cannot do this to your own account")
		return false
	}
	return true
}

func (h *Handler) memberSummary(ctx context.Context, id string) map[string]any {
	var name, email string
	_ = h.db.QueryRow(ctx, `SELECT name,email FROM users WHERE id=$1`, id).Scan(&name, &email)
	return map[string]any{"id": id, "name": name, "email": email}
}

// ---------------------------------------------------------------------------
// 1. Accounts

var roles = []string{"member", "admin", "super_admin"}
var statuses = []string{"member", "visitor", "transferred", "archived", "pastor", "leader", "staff"}

// MinPasswordLength is the length set in Security; never below 8.
func MinPasswordLength(ctx context.Context, db *pgxpool.Pool) int {
	return auth.MinPasswordLength(ctx, db)
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req struct {
		Name             string   `json:"name"`
		Email            string   `json:"email"`
		Password         string   `json:"password"`
		Role             string   `json:"role"`
		MembershipStatus string   `json:"membershipStatus"`
		Phone            string   `json:"phone"`
		Permissions      []string `json:"permissions"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" || !strings.Contains(req.Email, "@") {
		fail(c, http.StatusBadRequest, "Name and a valid email are required")
		return
	}
	ctx := c.Request.Context()
	role, status := cmpOr(req.Role, "member"), cmpOr(req.MembershipStatus, "member")
	if !slices.Contains(roles, role) || !slices.Contains(statuses, status) {
		fail(c, http.StatusBadRequest, "Unknown role or membership status")
		return
	}
	perms := []string{}
	for _, p := range req.Permissions {
		if slices.Contains(permissions.All, p) {
			perms = append(perms, p)
		}
	}
	// No shared default password: without one, a random temporary password is
	// shown once and the person must change it at first sign-in.
	password, temporary := req.Password, ""
	if password == "" {
		b := make([]byte, 9)
		_, _ = rand.Read(b)
		password = hex.EncodeToString(b)
		temporary = password
	} else if len(password) < MinPasswordLength(ctx, h.db) {
		fail(c, http.StatusBadRequest, fmt.Sprintf("Password must be at least %d characters", MinPasswordLength(ctx, h.db)))
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not secure the password")
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	var id string
	err = h.db.QueryRow(ctx, `INSERT INTO users(name,email,password_hash,role,membership_status,phone,permissions,password_reset_required)
		VALUES($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id::text`, strings.TrimSpace(req.Name), email, string(hash), role, status, strings.TrimSpace(req.Phone), perms).Scan(&id)
	if uniqueViolation(err) {
		fail(c, http.StatusConflict, "An account with this email already exists")
		return
	} else if err != nil {
		fail(c, http.StatusInternalServerError, "Could not create the account")
		return
	}
	h.audit(c, "CREATE_USER", "Created account "+email+" ("+role+")", id)
	out := gin.H{"id": id, "name": req.Name, "email": email, "role": role, "message": "Account created. They must set a new password when they first sign in."}
	if temporary != "" {
		out["temporaryPassword"] = temporary
	}
	c.JSON(http.StatusCreated, out)
}

func cmpOr(v, fallback string) string {
	if v = strings.TrimSpace(v); v == "" {
		return fallback
	}
	return v
}

func (h *Handler) GetUserProfile(c *gin.Context) {
	ctx := c.Request.Context()
	profile, err := h.rows(ctx, `SELECT id::text AS id,name,email,phone,role,membership_status AS "membershipStatus",permissions,is_active AS "isActive",
		suspended_at AS "suspendedAt",deleted_at AS "deletedAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM users WHERE id::text=$1`, c.Param("id"))
	if err != nil || len(profile) == 0 {
		fail(c, http.StatusNotFound, "Account not found")
		return
	}
	activity, _ := h.rows(ctx, `SELECT method,route,created_at AS at FROM staff_actions WHERE actor_id::text=$1 ORDER BY created_at DESC LIMIT 20`, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"profile": profile[0], "recentActivity": activity})
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
	}
	if c.ShouldBindJSON(&req) != nil {
		fail(c, http.StatusBadRequest, "Invalid update")
		return
	}
	if req.Role != nil && !slices.Contains(roles, *req.Role) || req.MembershipStatus != nil && !slices.Contains(statuses, *req.MembershipStatus) {
		fail(c, http.StatusBadRequest, "Unknown role or membership status")
		return
	}
	if me, _ := auth.UserIDFromContext(c); me == id && req.Role != nil && *req.Role != "super_admin" {
		fail(c, http.StatusBadRequest, "You cannot remove your own super admin role")
		return
	}
	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		fail(c, http.StatusServiceUnavailable, "Database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	var perms *[]string
	if req.Permissions != nil {
		list := []string{}
		for _, p := range *req.Permissions {
			if slices.Contains(permissions.All, p) {
				list = append(list, p)
			}
		}
		perms = &list
	}
	var email *string
	if req.Email != nil {
		e := strings.ToLower(strings.TrimSpace(*req.Email))
		email = &e
	}
	tag, err := tx.Exec(ctx, `UPDATE users SET name=COALESCE($2,name),email=COALESCE($3,email),phone=COALESCE($4,phone),role=COALESCE($5,role),
		membership_status=COALESCE($6,membership_status),permissions=COALESCE($7,permissions),password_reset_required=COALESCE($8,password_reset_required),
		session_version=session_version+CASE WHEN $5::text IS NOT NULL AND $5<>role THEN 1 ELSE 0 END,updated_at=NOW() WHERE id::text=$1`,
		id, req.Name, email, req.Phone, req.Role, req.MembershipStatus, perms, req.PasswordResetRequired)
	if uniqueViolation(err) {
		fail(c, http.StatusConflict, "Another account already uses this email")
		return
	} else if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Account not found")
		return
	}
	if h.superAdminCount(ctx, tx) == 0 {
		fail(c, http.StatusBadRequest, "At least one active super admin must remain")
		return
	}
	if tx.Commit(ctx) != nil {
		fail(c, http.StatusServiceUnavailable, "Could not save the changes")
		return
	}
	h.audit(c, "UPDATE_USER", "Updated account", id)
	webhooks.Emit("member.updated", h.memberSummary(ctx, id))
	c.JSON(http.StatusOK, gin.H{"message": "Account updated"})
}

// ToggleUserSuspend suspends an active account or reactivates a suspended one.
// A body {"suspend": bool} sets the state explicitly.
func (h *Handler) ToggleUserSuspend(c *gin.Context) {
	id := c.Param("id")
	if !notSelf(c, id) {
		return
	}
	var req struct {
		Suspend *bool `json:"suspend"`
	}
	_ = c.ShouldBindJSON(&req)
	ctx := c.Request.Context()
	var active bool
	if h.db.QueryRow(ctx, `SELECT is_active FROM users WHERE id::text=$1 AND deleted_at IS NULL`, id).Scan(&active) != nil {
		fail(c, http.StatusNotFound, "Account not found")
		return
	}
	suspend := active
	if req.Suspend != nil {
		suspend = *req.Suspend
	}
	// Bumping the session version signs the person out everywhere at once.
	_, err := h.db.Exec(ctx, `UPDATE users SET is_active=$2,suspended_at=CASE WHEN $2 THEN NULL ELSE NOW() END,session_version=session_version+1,updated_at=NOW() WHERE id::text=$1`, id, !suspend)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not change the account")
		return
	}
	if suspend {
		h.audit(c, "SUSPEND_USER", "Suspended account", id)
		webhooks.Emit("user.suspended", h.memberSummary(ctx, id))
		c.JSON(http.StatusOK, gin.H{"message": "Account suspended and signed out", "isActive": false})
		return
	}
	h.audit(c, "REACTIVATE_USER", "Reactivated account", id)
	c.JSON(http.StatusOK, gin.H{"message": "Account reactivated", "isActive": true})
}

// DeleteUser archives an account (mode=soft, default) or erases it (mode=hard).
func (h *Handler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	if !notSelf(c, id) {
		return
	}
	ctx := c.Request.Context()
	summary := h.memberSummary(ctx, id)
	if c.DefaultQuery("mode", "soft") == "hard" {
		if err := h.erase(ctx, id); err != nil {
			fail(c, http.StatusInternalServerError, err.Error())
			return
		}
		h.audit(c, "HARD_DELETE_USER", "Erased account "+fmt.Sprint(summary["email"]), id)
		webhooks.Emit("user.deleted", map[string]any{"id": id, "mode": "hard"})
		c.JSON(http.StatusOK, gin.H{"message": "Account and personal data erased"})
		return
	}
	tag, err := h.db.Exec(ctx, `UPDATE users SET is_active=FALSE,deleted_at=NOW(),session_version=session_version+1,updated_at=NOW() WHERE id::text=$1 AND deleted_at IS NULL`, id)
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Account not found")
		return
	}
	h.audit(c, "ARCHIVE_USER", "Archived account "+fmt.Sprint(summary["email"]), id)
	webhooks.Emit("user.deleted", map[string]any{"id": id, "mode": "soft", "email": summary["email"]})
	c.JSON(http.StatusOK, gin.H{"message": "Account archived; their history is kept"})
}

// erase removes a person and their personal data. Payments are kept for the
// accounts with the payer's details removed.
func (h *Handler) erase(ctx context.Context, id string) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return errors.New("database unavailable")
	}
	defer tx.Rollback(ctx)
	var role string
	if tx.QueryRow(ctx, `SELECT role FROM users WHERE id::text=$1 FOR UPDATE`, id).Scan(&role) != nil {
		return errors.New("account not found")
	}
	steps := []string{
		`UPDATE giving_transactions SET payer_name='',phone='',email='',user_id=NULL WHERE user_id::text=$1`,
		`UPDATE prayers SET reviewed_by=NULL WHERE reviewed_by::text=$1`,
		`DELETE FROM upload_sessions WHERE owner_id::text=$1`,
		`DELETE FROM users WHERE id::text=$1`,
	}
	for _, step := range steps {
		if _, err := tx.Exec(ctx, step, id); err != nil {
			return fmt.Errorf("could not erase the account: %v", err)
		}
	}
	if role == "super_admin" && h.superAdminCount(ctx, tx) == 0 {
		return errors.New("at least one active super admin must remain")
	}
	return tx.Commit(ctx)
}

// PurgeMemberDataGDPR erases a member on request (right to be forgotten).
func (h *Handler) PurgeMemberDataGDPR(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Reason == "" {
		req.Reason = c.Query("reason")
	}
	if strings.TrimSpace(req.Reason) == "" {
		fail(c, http.StatusBadRequest, "Record the reason for erasing this person's data")
		return
	}
	if !notSelf(c, id) {
		return
	}
	if err := h.erase(c.Request.Context(), id); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	h.audit(c, "ERASE_PERSONAL_DATA", "Erased personal data. Reason: "+strings.TrimSpace(req.Reason), id)
	webhooks.Emit("user.deleted", map[string]any{"id": id, "mode": "erased"})
	c.JSON(http.StatusOK, gin.H{"message": "Personal data erased. Payments remain in the accounts without the payer's details."})
}

// ---------------------------------------------------------------------------
// 2. Members: merging duplicates and pastoral notes

// MergeMemberProfiles moves a duplicate account's history (:id) into the
// account that is kept (mergeIntoId) and archives the duplicate.
func (h *Handler) MergeMemberProfiles(c *gin.Context) {
	duplicate := c.Param("id")
	var req struct {
		MergeIntoID string `json:"mergeIntoId"`
	}
	if c.ShouldBindJSON(&req) != nil || req.MergeIntoID == "" || req.MergeIntoID == duplicate {
		fail(c, http.StatusBadRequest, "Choose a different account to keep")
		return
	}
	if !notSelf(c, duplicate) {
		return
	}
	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		fail(c, http.StatusServiceUnavailable, "Database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	var ok bool
	if tx.QueryRow(ctx, `SELECT COUNT(*)=2 FROM users WHERE id::text IN ($1,$2) AND deleted_at IS NULL`, duplicate, req.MergeIntoID).Scan(&ok) != nil || !ok {
		fail(c, http.StatusNotFound, "Both accounts must exist and not be archived")
		return
	}
	moves := []string{
		`UPDATE giving_transactions SET user_id=$2::uuid WHERE user_id::text=$1`,
		`UPDATE pastoral_notes SET member_id=$2::uuid WHERE member_id::text=$1`,
		`INSERT INTO group_members(group_id,user_id,role,joined_at) SELECT group_id,$2::uuid,role,joined_at FROM group_members WHERE user_id::text=$1 ON CONFLICT DO NOTHING`,
	}
	cleanup := []string{
		`DELETE FROM group_members WHERE user_id::text=$1`,
		`UPDATE users SET is_active=FALSE,deleted_at=NOW(),session_version=session_version+1,updated_at=NOW() WHERE id::text=$1`,
	}
	for i, step := range append(moves, cleanup...) {
		args := []any{duplicate, req.MergeIntoID}
		if i >= len(moves) {
			args = args[:1]
		}
		if _, err := tx.Exec(ctx, step, args...); err != nil {
			log.Printf("merge %s into %s: %v", duplicate, req.MergeIntoID, err)
			fail(c, http.StatusInternalServerError, "Merge failed; nothing was changed")
			return
		}
	}
	if tx.Commit(ctx) != nil {
		fail(c, http.StatusInternalServerError, "Merge failed; nothing was changed")
		return
	}
	h.audit(c, "MERGE_MEMBERS", "Merged duplicate into "+req.MergeIntoID, duplicate)
	webhooks.Emit("member.updated", h.memberSummary(ctx, req.MergeIntoID))
	c.JSON(http.StatusOK, gin.H{"message": "Accounts merged. Giving, notes and groups moved; the duplicate was archived."})
}

func (h *Handler) ListPastoralNotes(c *gin.Context) {
	notes, err := h.rows(c.Request.Context(), `SELECT n.id::text AS id,n.body AS note,n.category,COALESCE(u.email,'') AS "authorEmail",COALESCE(u.name,'') AS "authorName",n.created_at AS "createdAt"
		FROM pastoral_notes n LEFT JOIN users u ON u.id=n.author_id WHERE n.member_id::text=$1 AND n.deleted_at IS NULL ORDER BY n.created_at DESC`, c.Param("id"))
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load notes")
		return
	}
	c.JSON(http.StatusOK, gin.H{"notes": notes})
}

func (h *Handler) CreatePastoralNote(c *gin.Context) {
	var req struct {
		Note     string `json:"note"`
		Category string `json:"category"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Note) == "" {
		fail(c, http.StatusBadRequest, "Write the note first")
		return
	}
	category := cmpOr(req.Category, "pastoral")
	if !slices.Contains([]string{"pastoral", "counseling", "prayer", "benevolence", "disciplinary"}, category) {
		fail(c, http.StatusBadRequest, "Unknown note category")
		return
	}
	author, _ := auth.UserIDFromContext(c)
	note := strings.TrimSpace(req.Note)
	title := note
	if r := []rune(title); len(r) > 60 {
		title = string(r[:60]) + "…"
	}
	var id string
	err := h.db.QueryRow(c.Request.Context(), `INSERT INTO pastoral_notes(member_id,author_id,category,title,body) SELECT u.id,NULLIF($2,'')::uuid,$3,$4,$5 FROM users u WHERE u.id::text=$1 RETURNING id::text`,
		c.Param("id"), author, category, title, note).Scan(&id)
	if err != nil {
		fail(c, http.StatusNotFound, "Member not found")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "Note saved"})
}

func (h *Handler) DeletePastoralNote(c *gin.Context) {
	sql := `UPDATE pastoral_notes SET deleted_at=NOW() WHERE id::text=$1 AND member_id::text=$2`
	if c.DefaultQuery("mode", "soft") == "hard" {
		sql = `DELETE FROM pastoral_notes WHERE id::text=$1 AND member_id::text=$2`
	}
	tag, err := h.db.Exec(c.Request.Context(), sql, c.Param("noteId"), c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Note not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Note removed"})
}

// ---------------------------------------------------------------------------
// 3. Finance

func (h *Handler) ListFunds(c *gin.Context) {
	funds, err := h.rows(c.Request.Context(), `SELECT id,name,code,description,is_tax_deductible AS "isTaxDeductible",is_active AS "isActive" FROM financial_funds ORDER BY code`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load funds")
		return
	}
	c.JSON(http.StatusOK, gin.H{"funds": funds})
}

var slug = regexp.MustCompile(`[^a-z0-9]+`)

func (h *Handler) SaveFund(c *gin.Context) {
	var req struct {
		ID              string `json:"id"`
		Name            string `json:"name"`
		Code            string `json:"code"`
		Description     string `json:"description"`
		IsTaxDeductible *bool  `json:"isTaxDeductible"`
		IsActive        *bool  `json:"isActive"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Code) == "" {
		fail(c, http.StatusBadRequest, "Fund name and code are required")
		return
	}
	id := strings.Trim(slug.ReplaceAllString(strings.ToLower(cmpOr(req.ID, req.Name)), "-"), "-")
	active, deductible := true, true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	if req.IsTaxDeductible != nil {
		deductible = *req.IsTaxDeductible
	}
	_, err := h.db.Exec(c.Request.Context(), `INSERT INTO financial_funds(id,name,code,description,is_tax_deductible,is_active) VALUES($1,$2,$3,$4,$5,$6)
		ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,code=EXCLUDED.code,description=EXCLUDED.description,is_tax_deductible=EXCLUDED.is_tax_deductible,is_active=EXCLUDED.is_active`,
		id, strings.TrimSpace(req.Name), strings.TrimSpace(req.Code), strings.TrimSpace(req.Description), deductible, active)
	if uniqueViolation(err) {
		fail(c, http.StatusConflict, "Another fund already uses this code")
		return
	} else if err != nil {
		fail(c, http.StatusInternalServerError, "Could not save the fund")
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Fund saved"})
}

// RecordManualTransaction enters money received outside the app (cash,
// cheque, bank transfer or a paybill payment not matched automatically).
func (h *Handler) RecordManualTransaction(c *gin.Context) {
	var req struct {
		FundID   string  `json:"fundId"`
		Amount   float64 `json:"amount"`
		Currency string  `json:"currency"`
		Type     string  `json:"type"`
		DonorID  string  `json:"donorId"`
		Notes    string  `json:"notes"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Amount <= 0 || req.Amount > 100_000_000 || math.IsNaN(req.Amount) {
		fail(c, http.StatusBadRequest, "Enter an amount greater than zero")
		return
	}
	method := cmpOr(req.Type, "cash")
	if !slices.Contains([]string{"cash", "check", "transfer", "mpesa"}, method) {
		fail(c, http.StatusBadRequest, "Unknown payment type")
		return
	}
	ctx := c.Request.Context()
	var fund string
	if h.db.QueryRow(ctx, `SELECT name FROM financial_funds WHERE id=$1 AND is_active`, req.FundID).Scan(&fund) != nil {
		fail(c, http.StatusBadRequest, "Choose an active fund")
		return
	}
	var payer, email string
	if req.DonorID != "" && h.db.QueryRow(ctx, `SELECT name,email FROM users WHERE id::text=$1`, req.DonorID).Scan(&payer, &email) != nil {
		fail(c, http.StatusBadRequest, "Donor not found")
		return
	}
	id, amount := randomID("manual"), int(math.Round(req.Amount))
	_, err := h.db.Exec(ctx, `INSERT INTO giving_transactions(id,category,method,phone,amount,note,status,user_id,email,currency,provider,provider_reference,payer_name,created_at,updated_at)
		VALUES($1,$2,$3,'',$4,$5,'success',NULLIF($6,'')::uuid,$7,$8,'manual',$1,$9,NOW(),NOW())`,
		id, fund, "manual_"+method, amount, strings.TrimSpace(req.Notes), req.DonorID, email, cmpOr(req.Currency, "KES"), payer)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not record the payment")
		return
	}
	h.audit(c, "MANUAL_PAYMENT", fmt.Sprintf("Recorded %s %d to %s (%s)", cmpOr(req.Currency, "KES"), amount, fund, method), id)
	c.JSON(http.StatusCreated, gin.H{"id": id, "reference": id, "message": "Payment recorded"})
}

func (h *Handler) ProcessRefund(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Reason) == "" {
		fail(c, http.StatusBadRequest, "A reason is required for a refund")
		return
	}
	ctx := c.Request.Context()
	var amount int
	var category, currency string
	err := h.db.QueryRow(ctx, `UPDATE giving_transactions SET status='refunded',note=CONCAT_WS(' | ',NULLIF(note,''),'Refunded: '||$2),updated_at=NOW()
		WHERE id=$1 AND status='success' RETURNING amount,category,COALESCE(currency,'KES')`, c.Param("id"), strings.TrimSpace(req.Reason)).Scan(&amount, &category, &currency)
	if err != nil {
		fail(c, http.StatusNotFound, "No confirmed payment with this reference")
		return
	}
	h.audit(c, "REFUND", "Refunded. Reason: "+strings.TrimSpace(req.Reason), c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Payment marked as refunded"})
}

func (h *Handler) HardDeleteFinancialEntry(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Reason) == "" {
		fail(c, http.StatusBadRequest, "A reason is required to delete a payment record")
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), `DELETE FROM giving_transactions WHERE id=$1`, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Payment record not found")
		return
	}
	h.audit(c, "DELETE_PAYMENT", "Deleted payment record. Reason: "+strings.TrimSpace(req.Reason), c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Payment record deleted"})
}

func (h *Handler) GenerateDonorStatement(c *gin.Context) {
	year := c.DefaultQuery("year", fmt.Sprint(time.Now().Year()))
	if !regexp.MustCompile(`^20[0-9]{2}$`).MatchString(year) {
		fail(c, http.StatusBadRequest, "Enter a year such as 2026")
		return
	}
	ctx := c.Request.Context()
	member := h.memberSummary(ctx, c.Param("id"))
	if member["email"] == "" {
		fail(c, http.StatusNotFound, "Member not found")
		return
	}
	items, err := h.rows(ctx, `SELECT g.created_at AS date,g.amount::bigint AS amount,COALESCE(g.currency,'KES') AS currency,g.category,g.method,COALESCE(NULLIF(g.mpesa_receipt_number,''),NULLIF(g.provider_reference,''),g.id) AS reference
		FROM giving_transactions g JOIN users u ON u.id::text=$1
		WHERE (g.user_id=u.id OR (g.user_id IS NULL AND g.email<>'' AND lower(g.email)=lower(u.email))) AND g.status='success'
		  AND EXTRACT(YEAR FROM g.created_at AT TIME ZONE 'Africa/Nairobi')=$2::int ORDER BY g.created_at`, c.Param("id"), year)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not build the statement")
		return
	}
	totals := map[string]int64{}
	for _, item := range items {
		amount, _ := item["amount"].(int64)
		totals[fmt.Sprint(item["currency"])] += amount
	}
	c.JSON(http.StatusOK, gin.H{"member": member, "year": year, "totals": totals, "contributions": items})
}

// Kiosks are the church's giving terminals and tablets, recorded so they can
// be locked or removed if lost.
func (h *Handler) ListKiosks(c *gin.Context) {
	kiosks, err := h.rows(c.Request.Context(), `SELECT id,name,location,serial_number AS "serialNumber",code AS "pairingCode",is_locked AS locked,paired_at AS "pairedAt",last_ping_at AS "lastPingAt" FROM giving_kiosks ORDER BY paired_at DESC`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load kiosks")
		return
	}
	c.JSON(http.StatusOK, gin.H{"kiosks": kiosks})
}

func (h *Handler) PairKiosk(c *gin.Context) {
	var req struct {
		Name         string `json:"name"`
		Location     string `json:"location"`
		SerialNumber string `json:"serialNumber"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" {
		fail(c, http.StatusBadRequest, "Name the kiosk")
		return
	}
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	code := fmt.Sprintf("%06d", (uint32(b[0])<<24|uint32(b[1])<<16|uint32(b[2])<<8|uint32(b[3]))%1_000_000)
	id := randomID("kiosk")
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO giving_kiosks(id,name,code,location,serial_number) VALUES($1,$2,$3,$4,$5)`, id, strings.TrimSpace(req.Name), code, strings.TrimSpace(req.Location), strings.TrimSpace(req.SerialNumber)); err != nil {
		fail(c, http.StatusInternalServerError, "Could not register the kiosk")
		return
	}
	h.audit(c, "KIOSK_ADDED", "Registered kiosk "+strings.TrimSpace(req.Name), id)
	c.JSON(http.StatusCreated, gin.H{"id": id, "pairingCode": code, "message": "Kiosk registered"})
}

func (h *Handler) ToggleKioskLock(c *gin.Context) {
	var req struct {
		Locked *bool `json:"locked"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Locked == nil {
		fail(c, http.StatusBadRequest, "Say whether to lock the kiosk")
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE giving_kiosks SET is_locked=$2 WHERE id=$1`, c.Param("id"), *req.Locked)
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Kiosk not found")
		return
	}
	h.audit(c, "KIOSK_LOCK", fmt.Sprintf("Kiosk locked=%v", *req.Locked), c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Kiosk updated"})
}

func (h *Handler) UnbindKiosk(c *gin.Context) {
	tag, err := h.db.Exec(c.Request.Context(), `DELETE FROM giving_kiosks WHERE id=$1`, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Kiosk not found")
		return
	}
	h.audit(c, "KIOSK_REMOVED", "Removed kiosk", c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Kiosk removed"})
}

// ---------------------------------------------------------------------------
// 4. Groups

var groupTypes = []string{"ministry", "department", "small_group", "committee", "sunday_school", "fellowship"}

func (h *Handler) ListGroups(c *gin.Context) {
	groups, err := h.rows(c.Request.Context(), `SELECT g.id,g.name,g.type,COALESCE(g.leader_id::text,'') AS "leaderId",COALESCE(u.name,'') AS "leaderName",g.location,g.schedule,
		g.max_capacity AS "maxCapacity",(SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) AS "memberCount",g.deleted_at IS NOT NULL AS archived
		FROM ministry_groups g LEFT JOIN users u ON u.id=g.leader_id ORDER BY g.deleted_at IS NOT NULL,g.name`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load groups")
		return
	}
	c.JSON(http.StatusOK, gin.H{"groups": groups})
}

func (h *Handler) SaveGroup(c *gin.Context) {
	var req struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Type        string `json:"type"`
		LeaderID    string `json:"leaderId"`
		Location    string `json:"location"`
		Schedule    string `json:"schedule"`
		MaxCapacity int    `json:"maxCapacity"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" || !slices.Contains(groupTypes, req.Type) || req.MaxCapacity < 0 {
		fail(c, http.StatusBadRequest, "Give the group a name and type")
		return
	}
	id := cmpOr(req.ID, randomID("grp"))
	_, err := h.db.Exec(c.Request.Context(), `INSERT INTO ministry_groups(id,name,type,leader_id,location,schedule,max_capacity) VALUES($1,$2,$3,NULLIF($4,'')::uuid,$5,$6,$7)
		ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,leader_id=EXCLUDED.leader_id,location=EXCLUDED.location,schedule=EXCLUDED.schedule,max_capacity=EXCLUDED.max_capacity,deleted_at=NULL`,
		id, strings.TrimSpace(req.Name), req.Type, req.LeaderID, strings.TrimSpace(req.Location), strings.TrimSpace(req.Schedule), req.MaxCapacity)
	if err != nil {
		fail(c, http.StatusBadRequest, "Could not save the group; check the leader")
		return
	}
	if req.LeaderID != "" {
		_, _ = h.db.Exec(c.Request.Context(), `INSERT INTO group_members(group_id,user_id,role) VALUES($1,$2::uuid,'leader') ON CONFLICT(group_id,user_id) DO UPDATE SET role='leader'`, id, req.LeaderID)
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Group saved"})
}

func (h *Handler) DeleteGroup(c *gin.Context) {
	sql := `UPDATE ministry_groups SET deleted_at=NOW() WHERE id=$1`
	if c.DefaultQuery("mode", "soft") == "hard" {
		sql = `DELETE FROM ministry_groups WHERE id=$1`
	}
	tag, err := h.db.Exec(c.Request.Context(), sql, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Group not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Group removed"})
}

func (h *Handler) ListGroupRoster(c *gin.Context) {
	members, err := h.rows(c.Request.Context(), `SELECT u.id::text AS "userId",u.name,u.email,m.role,m.joined_at AS "joinedAt" FROM group_members m JOIN users u ON u.id=m.user_id
		WHERE m.group_id=$1 ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,u.name`, c.Param("id"))
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load the members")
		return
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *Handler) AssignGroupMember(c *gin.Context) {
	var req struct {
		UserID string `json:"userId"`
		Role   string `json:"role"`
	}
	role := "member"
	if c.ShouldBindJSON(&req) != nil || req.UserID == "" {
		fail(c, http.StatusBadRequest, "Choose a member")
		return
	}
	if req.Role != "" {
		role = req.Role
	}
	if !slices.Contains([]string{"leader", "assistant", "member"}, role) {
		fail(c, http.StatusBadRequest, "Unknown group role")
		return
	}
	ctx := c.Request.Context()
	var capacity, count int
	if h.db.QueryRow(ctx, `SELECT max_capacity,(SELECT COUNT(*) FROM group_members WHERE group_id=$1 AND user_id::text<>$2) FROM ministry_groups WHERE id=$1 AND deleted_at IS NULL`, c.Param("id"), req.UserID).Scan(&capacity, &count) != nil {
		fail(c, http.StatusNotFound, "Group not found")
		return
	}
	if capacity > 0 && count >= capacity {
		fail(c, http.StatusConflict, "This group is full")
		return
	}
	if _, err := h.db.Exec(ctx, `INSERT INTO group_members(group_id,user_id,role) VALUES($1,$2::uuid,$3) ON CONFLICT(group_id,user_id) DO UPDATE SET role=EXCLUDED.role`, c.Param("id"), req.UserID, role); err != nil {
		fail(c, http.StatusBadRequest, "Member not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Member added"})
}

func (h *Handler) RemoveGroupMember(c *gin.Context) {
	tag, err := h.db.Exec(c.Request.Context(), `DELETE FROM group_members WHERE group_id=$1 AND user_id::text=$2`, c.Param("id"), c.Param("userId"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Not a member of this group")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

// ---------------------------------------------------------------------------
// 5. Attendance headcounts

func (h *Handler) ListAttendanceSessions(c *gin.Context) {
	sessions, err := h.rows(c.Request.Context(), `SELECT id,title,occasion,date::text AS "sessionDate",headcount,notes,kiosk_locked AS "kioskLocked",deleted_at IS NOT NULL AS archived
		FROM attendance_sessions ORDER BY deleted_at IS NOT NULL,date DESC,created_at DESC LIMIT 200`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load attendance")
		return
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (h *Handler) CreateAttendanceSession(c *gin.Context) {
	var req struct {
		Title       string `json:"title"`
		Occasion    string `json:"occasion"`
		SessionDate string `json:"sessionDate"`
		Headcount   int    `json:"headcount"`
		Notes       string `json:"notes"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Occasion) == "" || req.Headcount < 0 {
		fail(c, http.StatusBadRequest, "Title and occasion are required")
		return
	}
	date := cmpOr(req.SessionDate, time.Now().In(nairobi()).Format("2006-01-02"))
	if _, err := time.Parse("2006-01-02", date); err != nil {
		fail(c, http.StatusBadRequest, "Use a date like 2026-11-01")
		return
	}
	id := randomID("att")
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO attendance_sessions(id,title,date,occasion,headcount,notes) VALUES($1,$2,$3::date,$4,$5,$6)`,
		id, strings.TrimSpace(req.Title), date, strings.TrimSpace(req.Occasion), req.Headcount, strings.TrimSpace(req.Notes)); err != nil {
		fail(c, http.StatusInternalServerError, "Could not save the session")
		return
	}
	webhooks.Emit("attendance.session.created", map[string]any{"id": id, "title": strings.TrimSpace(req.Title), "date": date, "headcount": req.Headcount})
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "Attendance recorded"})
}

func nairobi() *time.Location {
	if l, err := time.LoadLocation("Africa/Nairobi"); err == nil {
		return l
	}
	return time.FixedZone("EAT", 3*3600)
}

func (h *Handler) UpdateAttendanceSession(c *gin.Context) {
	var req struct {
		Headcount   *int    `json:"headcount"`
		KioskLocked *bool   `json:"kioskLocked"`
		Notes       *string `json:"notes"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Headcount != nil && *req.Headcount < 0 {
		fail(c, http.StatusBadRequest, "Invalid update")
		return
	}
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE attendance_sessions SET headcount=COALESCE($2,headcount),kiosk_locked=COALESCE($3,kiosk_locked),notes=COALESCE($4,notes) WHERE id=$1`,
		c.Param("id"), req.Headcount, req.KioskLocked, req.Notes)
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Session not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Attendance updated"})
}

func (h *Handler) DeleteAttendanceSession(c *gin.Context) {
	sql := `UPDATE attendance_sessions SET deleted_at=NOW() WHERE id=$1`
	if c.DefaultQuery("mode", "soft") == "hard" {
		sql = `DELETE FROM attendance_sessions WHERE id=$1`
	}
	tag, err := h.db.Exec(c.Request.Context(), sql, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Session not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Session removed"})
}

// ---------------------------------------------------------------------------
// 7. Message templates

func (h *Handler) ListTemplates(c *gin.Context) {
	templates, err := h.rows(c.Request.Context(), `SELECT id,name,channel,subject,body,array_to_string(variables,', ') AS variables,is_active AS "isActive"
		FROM comm_templates WHERE deleted_at IS NULL ORDER BY name`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load templates")
		return
	}
	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func (h *Handler) SaveTemplate(c *gin.Context) {
	var req struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Channel   string `json:"channel"`
		Subject   string `json:"subject"`
		Body      string `json:"body"`
		Variables string `json:"variables"`
		IsActive  *bool  `json:"isActive"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Body) == "" || !slices.Contains([]string{"sms", "email", "push", "whatsapp"}, req.Channel) {
		fail(c, http.StatusBadRequest, "Name, channel and message are required")
		return
	}
	vars := []string{}
	for _, v := range strings.Split(req.Variables, ",") {
		if v = strings.Trim(strings.TrimSpace(v), "{}"); v != "" {
			vars = append(vars, v)
		}
	}
	active := req.IsActive == nil || *req.IsActive
	id := cmpOr(req.ID, randomID("tmpl"))
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO comm_templates(id,name,channel,subject,body,variables,is_active) VALUES($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,channel=EXCLUDED.channel,subject=EXCLUDED.subject,body=EXCLUDED.body,variables=EXCLUDED.variables,is_active=EXCLUDED.is_active,deleted_at=NULL`,
		id, strings.TrimSpace(req.Name), req.Channel, strings.TrimSpace(req.Subject), req.Body, vars, active); err != nil {
		fail(c, http.StatusInternalServerError, "Could not save the template")
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Template saved"})
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE comm_templates SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Template not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Template removed"})
}

// ---------------------------------------------------------------------------
// 8. API keys and webhooks

func (h *Handler) ListApiKeys(c *gin.Context) {
	keys, err := h.rows(c.Request.Context(), `SELECT k.id,k.name,k.key_prefix AS prefix,k.permissions,k.last_used_at AS "lastUsedAt",k.expires_at AS "expiresAt",
		k.revoked_at IS NOT NULL AS revoked,k.created_at AS "createdAt",COALESCE(u.email,'') AS "createdBy" FROM api_keys k LEFT JOIN users u ON u.id=k.created_by ORDER BY k.revoked_at IS NOT NULL,k.created_at DESC`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load API keys")
		return
	}
	c.JSON(http.StatusOK, gin.H{"keys": keys})
}

func (h *Handler) CreateApiKey(c *gin.Context) {
	var req struct {
		Name          string   `json:"name"`
		Permissions   []string `json:"permissions"`
		ExpiresInDays int      `json:"expiresInDays"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Name) == "" || len(req.Permissions) == 0 {
		fail(c, http.StatusBadRequest, "Name the key and choose at least one permission")
		return
	}
	for _, p := range req.Permissions {
		if !slices.Contains(permissions.All, p) {
			fail(c, http.StatusBadRequest, "Unknown permission "+p)
			return
		}
	}
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	key := "sk_live_" + hex.EncodeToString(b)
	creator, _ := auth.UserIDFromContext(c)
	var expires *time.Time
	if req.ExpiresInDays > 0 {
		t := time.Now().AddDate(0, 0, req.ExpiresInDays)
		expires = &t
	}
	id := randomID("key")
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO api_keys(id,name,key_prefix,key_hash,permissions,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6::uuid,$7)`,
		id, strings.TrimSpace(req.Name), key[:12]+"…", auth.HashAPIKey(key), req.Permissions, creator, expires); err != nil {
		fail(c, http.StatusInternalServerError, "Could not create the key")
		return
	}
	h.audit(c, "API_KEY_CREATED", "Created API key "+strings.TrimSpace(req.Name)+" ("+strings.Join(req.Permissions, ", ")+")", id)
	c.JSON(http.StatusCreated, gin.H{"id": id, "key": key, "message": "Copy this key now; it will not be shown again. Send it in the X-API-Key header."})
}

func (h *Handler) RevokeApiKey(c *gin.Context) {
	tag, err := h.db.Exec(c.Request.Context(), `UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL`, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Key not found or already revoked")
		return
	}
	h.audit(c, "API_KEY_REVOKED", "Revoked API key", c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Key revoked; it stops working immediately"})
}

func (h *Handler) ListWebhooks(c *gin.Context) {
	hooks, err := h.rows(c.Request.Context(), `SELECT id,url,events,is_active AS "isActive",secret,last_status AS "lastStatus",last_triggered_at AS "lastTriggered",created_at AS "createdAt" FROM webhooks ORDER BY created_at DESC`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load webhooks")
		return
	}
	c.JSON(http.StatusOK, gin.H{"webhooks": hooks, "events": webhooks.Events})
}

func (h *Handler) SaveWebhook(c *gin.Context) {
	var req struct {
		ID       string   `json:"id"`
		URL      string   `json:"url"`
		Events   []string `json:"events"`
		IsActive *bool    `json:"isActive"`
	}
	if c.ShouldBindJSON(&req) != nil || !webhooks.ValidURL(req.URL) {
		fail(c, http.StatusBadRequest, "Enter an https:// address")
		return
	}
	if len(req.Events) == 0 {
		fail(c, http.StatusBadRequest, "Choose at least one event")
		return
	}
	for _, e := range req.Events {
		if !slices.Contains(webhooks.Events, e) {
			fail(c, http.StatusBadRequest, "Unknown event "+e)
			return
		}
	}
	active := req.IsActive == nil || *req.IsActive
	id := cmpOr(req.ID, randomID("wh"))
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO webhooks(id,url,events,secret,is_active) VALUES($1,$2,$3,$4,$5)
		ON CONFLICT(id) DO UPDATE SET url=EXCLUDED.url,events=EXCLUDED.events,is_active=EXCLUDED.is_active`, id, strings.TrimSpace(req.URL), req.Events, webhooks.NewSecret(), active); err != nil {
		fail(c, http.StatusInternalServerError, "Could not save the webhook")
		return
	}
	h.audit(c, "WEBHOOK_SAVED", "Webhook to "+strings.TrimSpace(req.URL), id)
	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Webhook saved"})
}

func (h *Handler) TestWebhook(c *gin.Context) {
	var address, secret string
	if h.db.QueryRow(c.Request.Context(), `SELECT url,secret FROM webhooks WHERE id=$1`, c.Param("id")).Scan(&address, &secret) != nil {
		fail(c, http.StatusNotFound, "Webhook not found")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()
	status := webhooks.Deliver(ctx, c.Param("id"), address, secret, "test.ping", map[string]any{"message": "Test from Shekinah Sons Global"})
	if status == 0 {
		c.JSON(http.StatusOK, gin.H{"status": 0, "message": "Could not reach the address"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": status, "message": fmt.Sprintf("The address answered %d", status)})
}

func (h *Handler) DeleteWebhook(c *gin.Context) {
	tag, err := h.db.Exec(c.Request.Context(), `DELETE FROM webhooks WHERE id=$1`, c.Param("id"))
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Webhook not found")
		return
	}
	h.audit(c, "WEBHOOK_DELETED", "Deleted webhook", c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Webhook deleted"})
}

// ---------------------------------------------------------------------------
// 9. Audit trail, feature switches, security, backup

func (h *Handler) GetAuditTrail(c *gin.Context) {
	var limit, offset int
	_, _ = fmt.Sscan(c.DefaultQuery("limit", "50"), &limit)
	_, _ = fmt.Sscan(c.DefaultQuery("offset", "0"), &offset)
	limit, offset = min(max(limit, 1), 200), max(offset, 0)
	q := "%" + strings.ToLower(strings.TrimSpace(c.Query("query"))) + "%"
	entries, err := h.rows(c.Request.Context(), `SELECT a.id::text AS id,COALESCE(u.email,'System') AS "actorEmail",a.method,a.route,COALESCE(a.item_id,'') AS "itemId",a.created_at AS "createdAt"
		FROM staff_actions a LEFT JOIN users u ON u.id=a.actor_id
		WHERE lower(a.route) LIKE $1 OR lower(a.method) LIKE $1 OR lower(COALESCE(u.email,'')) LIKE $1
		ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`, q, limit, offset)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not load the audit trail")
		return
	}
	c.JSON(http.StatusOK, gin.H{"entries": entries})
}

// PurgeAuditTrail removes entries older than 90 days; recent history is kept
// so no one can erase the record of what they just did.
func (h *Handler) PurgeAuditTrail(c *gin.Context) {
	tag, err := h.db.Exec(c.Request.Context(), `DELETE FROM staff_actions WHERE created_at < NOW()-INTERVAL '90 days'`)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not clean up the audit trail")
		return
	}
	h.audit(c, "AUDIT_CLEANUP", fmt.Sprintf("Removed %d entries older than 90 days", tag.RowsAffected()), "")
	c.JSON(http.StatusOK, gin.H{"removed": tag.RowsAffected(), "message": fmt.Sprintf("Removed %d entries older than 90 days", tag.RowsAffected())})
}

// Modules lists the features a super admin may switch off for everyone.
var Modules = []string{"onlineGiving", "livestream", "communityChat", "volunteerScheduling", "attendanceKiosk", "counseling", "taxStatements"}

// LoadModules returns every module's state; unknown or missing ones are on.
func LoadModules(ctx context.Context, db *pgxpool.Pool) map[string]bool {
	out := map[string]bool{}
	for _, m := range Modules {
		out[m] = true
	}
	var raw string
	if db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key='system_modules'`).Scan(&raw) == nil {
		saved := map[string]any{}
		if json.Unmarshal([]byte(raw), &saved) == nil {
			if inner, ok := saved["modules"].(map[string]any); ok { // early saves wrapped the map
				saved = inner
			}
			for _, m := range Modules {
				if v, ok := saved[m].(bool); ok {
					out[m] = v
				}
			}
		}
	}
	return out
}

func (h *Handler) GetSystemModules(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"modules": LoadModules(c.Request.Context(), h.db)})
}

func (h *Handler) UpdateSystemModules(c *gin.Context) {
	var req struct {
		Modules map[string]bool `json:"modules"`
	}
	if c.ShouldBindJSON(&req) != nil {
		fail(c, http.StatusBadRequest, "Invalid settings")
		return
	}
	modules := LoadModules(c.Request.Context(), h.db)
	for _, m := range Modules {
		if v, ok := req.Modules[m]; ok {
			modules[m] = v
		}
	}
	raw, _ := json.Marshal(modules)
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO app_settings(key,value,updated_at) VALUES('system_modules',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, string(raw)); err != nil {
		fail(c, http.StatusInternalServerError, "Could not save the settings")
		return
	}
	moduleState.Lock()
	moduleState.state = nil
	moduleState.Unlock()
	h.audit(c, "MODULES_UPDATED", "Feature switches: "+string(raw), "")
	c.JSON(http.StatusOK, gin.H{"modules": modules, "message": "Feature switches saved"})
}

func (h *Handler) GetSecurityPolicies(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"policies": gin.H{"minPasswordLength": MinPasswordLength(c.Request.Context(), h.db)}})
}

func (h *Handler) UpdateSecurityPolicies(c *gin.Context) {
	var req struct {
		Policies struct {
			MinPasswordLength int `json:"minPasswordLength"`
		} `json:"policies"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Policies.MinPasswordLength < 8 || req.Policies.MinPasswordLength > 64 {
		fail(c, http.StatusBadRequest, "Minimum password length must be between 8 and 64")
		return
	}
	raw, _ := json.Marshal(gin.H{"minPasswordLength": req.Policies.MinPasswordLength})
	if _, err := h.db.Exec(c.Request.Context(), `INSERT INTO app_settings(key,value,updated_at) VALUES('security_policies',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, string(raw)); err != nil {
		fail(c, http.StatusInternalServerError, "Could not save the policy")
		return
	}
	h.audit(c, "SECURITY_POLICY", "Minimum password length "+fmt.Sprint(req.Policies.MinPasswordLength), "")
	c.JSON(http.StatusOK, gin.H{"message": "Security policy saved"})
}

// TriggerDatabaseBackup streams a compressed copy of every table (one CSV per
// table) straight to the super admin. Nothing is left on the server or in
// public storage.
func (h *Handler) TriggerDatabaseBackup(c *gin.Context) {
	ctx := c.Request.Context()
	tables := []string{}
	r, err := h.db.Query(ctx, `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)
	if err == nil {
		tables, err = pgx.CollectRows(r, pgx.RowTo[string])
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "Could not read the database")
		return
	}
	conn, err := h.db.Acquire(ctx)
	if err != nil {
		fail(c, http.StatusServiceUnavailable, "Database unavailable")
		return
	}
	defer conn.Release()
	// One consistent snapshot for every table.
	tx, err := conn.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		fail(c, http.StatusServiceUnavailable, "Database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	stamp := time.Now().In(nairobi()).Format("2006-01-02-1504")
	h.audit(c, "BACKUP", "Downloaded database backup", stamp)
	c.Header("Content-Type", "application/gzip")
	c.Header("Content-Disposition", `attachment; filename="shekinah-backup-`+stamp+`.tar.gz"`)
	c.Header("Cache-Control", "no-store")
	c.Status(http.StatusOK)
	gz := gzip.NewWriter(c.Writer)
	tw := tar.NewWriter(gz)
	for _, table := range tables {
		var buf strings.Builder
		if _, err := tx.Conn().PgConn().CopyTo(ctx, &buf, fmt.Sprintf(`COPY public.%s TO STDOUT WITH (FORMAT csv, HEADER)`, pgx.Identifier{table}.Sanitize())); err != nil {
			continue
		}
		data := buf.String()
		_ = tw.WriteHeader(&tar.Header{Name: table + ".csv", Mode: 0o600, Size: int64(len(data)), ModTime: time.Now()})
		_, _ = tw.Write([]byte(data))
	}
	_ = tw.Close()
	_ = gz.Close()
}
