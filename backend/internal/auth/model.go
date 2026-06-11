package auth

import "time"

type User struct {
	ID                    string
	Name                  string
	Email                 string
	PasswordHash          string
	Role                  string
	IsActive              bool
	PasswordResetRequired bool
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type PublicUser struct {
	ID                    string `json:"id"`
	Name                  string `json:"name"`
	Email                 string `json:"email"`
	Role                  string `json:"role"`
	IsActive              bool   `json:"isActive"`
	PasswordResetRequired bool   `json:"passwordResetRequired"`
	CreatedAt             string `json:"createdAt"`
}

type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type AuthResponse struct {
	Token string     `json:"token"`
	User  PublicUser `json:"user"`
}

func ToPublicUser(user User) PublicUser {
	return PublicUser{
		ID:                    user.ID,
		Name:                  user.Name,
		Email:                 user.Email,
		Role:                  user.Role,
		IsActive:              user.IsActive,
		PasswordResetRequired: user.PasswordResetRequired,
		CreatedAt:             user.CreatedAt.UTC().Format(time.RFC3339),
	}
}
