package database

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Demo migrations are retained for developer/test databases. A production API
// must never expose their known passwords, even behind a forced-reset screen.
// This check is read-only: it does not alter accounts or the ministry's admin.
func CheckProductionAccounts(ctx context.Context, db *pgxpool.Pool) error {
	rows, err := db.Query(ctx, `SELECT password_hash FROM users WHERE is_active AND (role IN ('admin','super_admin') OR lower(email) IN ('vincent@example.com','grace.member@example.com','daniel.member@example.com'))`)
	if err != nil {
		return errors.New("could not verify production account safety")
	}
	defer rows.Close()
	for rows.Next() {
		var hash string
		if rows.Scan(&hash) != nil {
			return errors.New("could not verify production account safety")
		}
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte("password123")) == nil {
			return errors.New("replace or deactivate accounts that still use the demonstration password before production startup")
		}
	}
	return rows.Err()
}
