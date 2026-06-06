package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInactiveUser       = errors.New("inactive user")
)

type Service struct {
	repository Repository
	jwtSecret  string
}

func NewService(repository Repository, jwtSecret string) Service {
	return Service{
		repository: repository,
		jwtSecret:  jwtSecret,
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
