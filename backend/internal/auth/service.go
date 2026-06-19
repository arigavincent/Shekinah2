package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInactiveUser       = errors.New("inactive user")
	ErrWeakPassword       = errors.New("weak password")
	ErrPasswordReused     = errors.New("password reused")
	ErrInvalidResetCode   = errors.New("invalid reset code")
	ErrResetCodeLocked    = errors.New("reset code locked")
)

type Service struct {
	repository Repository
	jwtSecret  string
	mailer     passwordResetMailer
}

func NewService(repository Repository, jwtSecret string) Service {
	return Service{
		repository: repository,
		jwtSecret:  jwtSecret,
		mailer:     passwordResetMailer{},
	}
}

func (s Service) Register(ctx context.Context, req RegisterRequest) (AuthResponse, error) {
	name := strings.TrimSpace(req.Name)
	email := normalizeEmail(req.Email)
	password := req.Password

	if name == "" || email == "" || password == "" {
		return AuthResponse{}, ErrInvalidInput
	}

	if len(password) < 8 {
		return AuthResponse{}, ErrInvalidInput
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResponse{}, fmt.Errorf("hash password: %w", err)
	}

	user, err := s.repository.CreateUser(ctx, name, email, string(hash))
	if err != nil {
		return AuthResponse{}, err
	}

	token, err := s.issueToken(user)
	if err != nil {
		return AuthResponse{}, err
	}

	return AuthResponse{
		Token: token,
		User:  ToPublicUser(user),
	}, nil
}

func (s Service) Login(ctx context.Context, req LoginRequest) (AuthResponse, error) {
	email := normalizeEmail(req.Email)

	if email == "" || req.Password == "" {
		return AuthResponse{}, ErrInvalidCredentials
	}

	user, err := s.repository.FindByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return AuthResponse{}, ErrInvalidCredentials
		}

		return AuthResponse{}, err
	}

	if !user.IsActive {
		return AuthResponse{}, ErrInactiveUser
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return AuthResponse{}, ErrInvalidCredentials
	}

	token, err := s.issueToken(user)
	if err != nil {
		return AuthResponse{}, err
	}

	return AuthResponse{
		Token: token,
		User:  ToPublicUser(user),
	}, nil
}

func (s Service) Me(ctx context.Context, userID string) (PublicUser, error) {
	user, err := s.repository.FindByID(ctx, userID)
	if err != nil {
		return PublicUser{}, err
	}

	if !user.IsActive {
		return PublicUser{}, ErrInactiveUser
	}

	return ToPublicUser(user), nil
}

func (s Service) ChangePassword(ctx context.Context, userID string, req ChangePasswordRequest) (AuthResponse, error) {
	currentPassword := strings.TrimSpace(req.CurrentPassword)
	newPassword := strings.TrimSpace(req.NewPassword)

	if currentPassword == "" || newPassword == "" {
		return AuthResponse{}, ErrInvalidInput
	}

	if len(newPassword) < 12 {
		return AuthResponse{}, ErrWeakPassword
	}

	if currentPassword == newPassword {
		return AuthResponse{}, ErrPasswordReused
	}

	user, err := s.repository.FindByID(ctx, userID)
	if err != nil {
		return AuthResponse{}, err
	}

	if !user.IsActive {
		return AuthResponse{}, ErrInactiveUser
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return AuthResponse{}, ErrInvalidCredentials
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return AuthResponse{}, fmt.Errorf("hash password: %w", err)
	}

	updatedUser, err := s.repository.UpdatePassword(ctx, userID, string(hash))
	if err != nil {
		return AuthResponse{}, err
	}

	token, err := s.issueToken(updatedUser)
	if err != nil {
		return AuthResponse{}, err
	}

	return AuthResponse{
		Token: token,
		User:  ToPublicUser(updatedUser),
	}, nil
}

func (s Service) RequestPasswordReset(ctx context.Context, req PasswordResetRequest) error {
	email := normalizeEmail(req.Email)
	if email == "" {
		return ErrInvalidInput
	}

	user, err := s.repository.FindByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			log.Printf("password reset requested for unknown email=%s", email)
			return nil
		}

		return err
	}

	if !user.IsActive {
		log.Printf("password reset requested for inactive user email=%s", email)
		return nil
	}

	code, err := generateResetCode()
	if err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password reset code: %w", err)
	}

	ttlMinutes := envInt("PASSWORD_RESET_TTL_MINUTES", 15)
	if ttlMinutes < 5 {
		ttlMinutes = 15
	}

	expiresAt := time.Now().UTC().Add(time.Duration(ttlMinutes) * time.Minute)
	if err := s.repository.CreatePasswordReset(ctx, user.ID, email, string(hash), expiresAt); err != nil {
		return err
	}

	go func() {
		if err := s.mailer.Send(email, code); err != nil {
			log.Printf("password reset email delivery failed email=%s error=%v", email, err)
		}
	}()

	return nil
}

func (s Service) ConfirmPasswordReset(ctx context.Context, req PasswordResetConfirmRequest) (AuthResponse, error) {
	email := normalizeEmail(req.Email)
	code := strings.TrimSpace(req.Code)
	newPassword := strings.TrimSpace(req.NewPassword)

	if email == "" || code == "" || newPassword == "" {
		return AuthResponse{}, ErrInvalidInput
	}

	if len(newPassword) < 8 {
		return AuthResponse{}, ErrWeakPassword
	}

	token, err := s.repository.FindLatestPasswordReset(ctx, email)
	if err != nil {
		if errors.Is(err, ErrResetNotFound) {
			return AuthResponse{}, ErrInvalidResetCode
		}

		return AuthResponse{}, err
	}

	maxAttempts := envInt("PASSWORD_RESET_MAX_ATTEMPTS", 5)
	if maxAttempts < 3 {
		maxAttempts = 5
	}

	if token.Attempts >= maxAttempts {
		return AuthResponse{}, ErrResetCodeLocked
	}

	if err := bcrypt.CompareHashAndPassword([]byte(token.CodeHash), []byte(code)); err != nil {
		_ = s.repository.IncrementPasswordResetAttempts(ctx, token.ID)
		return AuthResponse{}, ErrInvalidResetCode
	}

	user, err := s.repository.FindByID(ctx, token.UserID)
	if err != nil {
		return AuthResponse{}, err
	}

	if !user.IsActive {
		return AuthResponse{}, ErrInactiveUser
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(newPassword)) == nil {
		return AuthResponse{}, ErrPasswordReused
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return AuthResponse{}, fmt.Errorf("hash password: %w", err)
	}

	updatedUser, err := s.repository.UsePasswordResetAndUpdatePassword(ctx, token.ID, user.ID, string(hash))
	if err != nil {
		if errors.Is(err, ErrResetNotFound) {
			return AuthResponse{}, ErrInvalidResetCode
		}

		return AuthResponse{}, err
	}

	jwtToken, err := s.issueToken(updatedUser)
	if err != nil {
		return AuthResponse{}, err
	}

	return AuthResponse{
		Token: jwtToken,
		User:  ToPublicUser(updatedUser),
	}, nil
}

func (s Service) ParseToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, jwt.MapClaims{}, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}

		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		return "", ErrInvalidCredentials
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", ErrInvalidCredentials
	}

	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", ErrInvalidCredentials
	}

	return sub, nil
}

func (s Service) issueToken(user User) (string, error) {
	now := time.Now().UTC()

	claims := jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"iat":  now.Unix(),
		"exp":  now.Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signed, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("sign jwt: %w", err)
	}

	return signed, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func generateResetCode() (string, error) {
	max := big.NewInt(1000000)
	value, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("generate reset code: %w", err)
	}

	return fmt.Sprintf("%06d", value.Int64()), nil
}
