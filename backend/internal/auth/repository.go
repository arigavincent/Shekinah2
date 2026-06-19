package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound  = errors.New("user not found")
	ErrEmailTaken    = errors.New("email already exists")
	ErrResetNotFound = errors.New("password reset token not found")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) Repository {
	return Repository{db: db}
}

func (r Repository) CreateUser(ctx context.Context, name string, email string, passwordHash string) (User, error) {
	const query = `
		INSERT INTO users (name, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id::text, name, email, password_hash, role, is_active, password_reset_required, created_at, updated_at
	`

	var user User

	err := r.db.QueryRow(ctx, query, name, email, passwordHash).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.PasswordResetRequired,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return User{}, ErrEmailTaken
		}

		return User{}, fmt.Errorf("create user: %w", err)
	}

	return user, nil
}

func (r Repository) FindByEmail(ctx context.Context, email string) (User, error) {
	const query = `
		SELECT id::text, name, email, password_hash, role, is_active, password_reset_required, created_at, updated_at
		FROM users
		WHERE lower(trim(email)) = lower(trim($1))
		LIMIT 1
	`

	var user User

	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.PasswordResetRequired,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrUserNotFound
		}

		return User{}, fmt.Errorf("find user by email: %w", err)
	}

	return user, nil
}

func (r Repository) FindByID(ctx context.Context, id string) (User, error) {
	const query = `
		SELECT id::text, name, email, password_hash, role, is_active, password_reset_required, created_at, updated_at
		FROM users
		WHERE id = $1
		LIMIT 1
	`

	var user User

	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.PasswordResetRequired,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrUserNotFound
		}

		return User{}, fmt.Errorf("find user by id: %w", err)
	}

	return user, nil
}

func (r Repository) UpdatePassword(ctx context.Context, userID string, passwordHash string) (User, error) {
	const query = `
		UPDATE users
		SET password_hash = $2,
		    password_reset_required = false,
		    updated_at = now()
		WHERE id = $1
		RETURNING id::text, name, email, password_hash, role, is_active, password_reset_required, created_at, updated_at
	`

	var user User

	err := r.db.QueryRow(ctx, query, userID, passwordHash).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.PasswordResetRequired,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrUserNotFound
		}

		return User{}, fmt.Errorf("update user password: %w", err)
	}

	return user, nil
}

func (r Repository) CreatePasswordReset(ctx context.Context, userID string, email string, codeHash string, expiresAt time.Time) error {
	const query = `
		INSERT INTO password_reset_tokens (user_id, email, code_hash, expires_at)
		VALUES ($1, $2, $3, $4)
	`

	if _, err := r.db.Exec(ctx, query, userID, email, codeHash, expiresAt); err != nil {
		return fmt.Errorf("create password reset token: %w", err)
	}

	return nil
}

func (r Repository) FindLatestPasswordReset(ctx context.Context, email string) (PasswordResetToken, error) {
	const query = `
		SELECT id::text, user_id::text, email, code_hash, attempts, expires_at, used_at, created_at
		FROM password_reset_tokens
		WHERE lower(trim(email)) = lower(trim($1))
		  AND used_at IS NULL
		  AND expires_at > now()
		ORDER BY created_at DESC
		LIMIT 1
	`

	var token PasswordResetToken

	err := r.db.QueryRow(ctx, query, email).Scan(
		&token.ID,
		&token.UserID,
		&token.Email,
		&token.CodeHash,
		&token.Attempts,
		&token.ExpiresAt,
		&token.UsedAt,
		&token.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PasswordResetToken{}, ErrResetNotFound
		}

		return PasswordResetToken{}, fmt.Errorf("find password reset token: %w", err)
	}

	return token, nil
}

func (r Repository) IncrementPasswordResetAttempts(ctx context.Context, tokenID string) error {
	const query = `
		UPDATE password_reset_tokens
		SET attempts = attempts + 1
		WHERE id = $1
	`

	if _, err := r.db.Exec(ctx, query, tokenID); err != nil {
		return fmt.Errorf("increment password reset attempts: %w", err)
	}

	return nil
}

func (r Repository) UsePasswordResetAndUpdatePassword(ctx context.Context, tokenID string, userID string, passwordHash string) (User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("begin password reset transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	const useTokenQuery = `
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE id = $1
		  AND user_id = $2
		  AND used_at IS NULL
		  AND expires_at > now()
	`

	tag, err := tx.Exec(ctx, useTokenQuery, tokenID, userID)
	if err != nil {
		return User{}, fmt.Errorf("mark password reset token used: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return User{}, ErrResetNotFound
	}

	const updatePasswordQuery = `
		UPDATE users
		SET password_hash = $2,
		    password_reset_required = false,
		    updated_at = now()
		WHERE id = $1
		RETURNING id::text, name, email, password_hash, role, is_active, password_reset_required, created_at, updated_at
	`

	var user User
	err = tx.QueryRow(ctx, updatePasswordQuery, userID, passwordHash).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.PasswordResetRequired,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrUserNotFound
		}

		return User{}, fmt.Errorf("update password from reset: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("commit password reset transaction: %w", err)
	}

	return user, nil
}
