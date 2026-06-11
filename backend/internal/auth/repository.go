package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrEmailTaken   = errors.New("email already exists")
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
		WHERE email = $1
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
