// Package auth — аккаунт: регистрация, вход, выход, сессии в httpOnly-cookie.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	sessionTTL     = 30 * 24 * time.Hour
	emailVerifyTTL = 48 * time.Hour
	// pdPolicyVersion — версия политики обработки ПД, на которую пользователь дал согласие.
	// Поменять при выходе новой редакции документа.
	pdPolicyVersion = "1.0"
)

var (
	ErrEmailTaken         = errors.New("почта уже зарегистрирована")
	ErrInvalidCredentials = errors.New("неверная почта или пароль")
)

// User — пользователь в ответах API.
type User struct {
	ID            int64  `json:"id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Role          string `json:"role"`
	EmailVerified bool   `json:"email_verified"`
}

// Service — бизнес-логика аккаунта поверх PostgreSQL.
type Service struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewService(pool *pgxpool.Pool, log *slog.Logger) *Service {
	return &Service{pool: pool, log: log}
}

// RegisterInput — проверенные данные формы регистрации.
type RegisterInput struct {
	Email            string
	Password         string
	Name             string
	ConsentMarketing bool
	UserAgent        string
}

// Register создаёт пользователя, согласия, токен подтверждения почты и сессию.
// Возвращает пользователя и токен сессии для cookie.
func (s *Service) Register(ctx context.Context, in RegisterInput) (*User, string, error) {
	hash, err := HashPassword(in.Password)
	if err != nil {
		return nil, "", err
	}

	var user User
	var sessionToken, verifyToken string
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
			RETURNING id, email, name, role`, in.Email, hash, in.Name).
			Scan(&user.ID, &user.Email, &user.Name, &user.Role)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return ErrEmailTaken
			}
			return err
		}

		consents := []string{"pd_processing"}
		if in.ConsentMarketing {
			consents = append(consents, "marketing")
		}
		for _, t := range consents {
			if _, err := tx.Exec(ctx, `INSERT INTO consents (user_id, type, doc_version) VALUES ($1, $2, $3)`,
				user.ID, t, pdPolicyVersion); err != nil {
				return err
			}
		}

		verifyToken, err = newToken()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO auth_tokens (user_id, type, token_hash, expires_at) VALUES ($1, 'email_verify', $2, $3)`,
			user.ID, hashToken(verifyToken), time.Now().Add(emailVerifyTTL)); err != nil {
			return err
		}

		sessionToken, err = createSession(ctx, tx, user.ID, in.UserAgent)
		return err
	})
	if err != nil {
		return nil, "", err
	}

	// Почтового сервиса пока нет: ссылку подтверждения пишем в журнал (эндпоинт — срез 1).
	s.log.Info("письмо: подтверждение почты", "user_id", user.ID,
		"link", "/api/v1/auth/verify-email?token="+verifyToken)
	return &user, sessionToken, nil
}

// Login проверяет пароль и открывает новую сессию.
func (s *Service) Login(ctx context.Context, email, password, userAgent string) (*User, string, error) {
	var user User
	var hash string
	var verifiedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, name, role, email_verified_at, password_hash FROM users
		WHERE email = $1 AND status = 'active'`, email).
		Scan(&user.ID, &user.Email, &user.Name, &user.Role, &verifiedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		// Считаем хеш и для несуществующей почты, чтобы по времени ответа нельзя было узнать, есть ли аккаунт.
		_, _ = VerifyPassword(password, dummyHash)
		return nil, "", ErrInvalidCredentials
	}
	if err != nil {
		return nil, "", err
	}
	ok, err := VerifyPassword(password, hash)
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, "", ErrInvalidCredentials
	}
	user.EmailVerified = verifiedAt != nil

	var token string
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE users SET last_login_at = now() WHERE id = $1`, user.ID); err != nil {
			return err
		}
		token, err = createSession(ctx, tx, user.ID, userAgent)
		return err
	})
	if err != nil {
		return nil, "", err
	}
	return &user, token, nil
}

// Logout закрывает сессию по токену из cookie.
func (s *Service) Logout(ctx context.Context, token string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
		hashToken(token))
	return err
}

// UserBySession возвращает пользователя действующей сессии или nil.
func (s *Service) UserBySession(ctx context.Context, token string) (*User, error) {
	var user User
	var verifiedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT u.id, u.email, u.name, u.role, u.email_verified_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
		  AND u.status = 'active'`, hashToken(token)).
		Scan(&user.ID, &user.Email, &user.Name, &user.Role, &verifiedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	user.EmailVerified = verifiedAt != nil
	return &user, nil
}

func createSession(ctx context.Context, tx pgx.Tx, userID int64, userAgent string) (string, error) {
	token, err := newToken()
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO sessions (user_id, refresh_token_hash, user_agent, expires_at) VALUES ($1, $2, $3, $4)`,
		userID, hashToken(token), truncate(userAgent, 500), time.Now().Add(sessionTTL))
	if err != nil {
		return "", fmt.Errorf("создание сессии: %w", err)
	}
	return token, nil
}

// newToken — 32 случайных байта в base64url; в базу попадает только его хеш.
func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

// dummyHash — хеш случайного пароля для выравнивания времени ответа.
var dummyHash = func() string {
	h, _ := HashPassword("dummy-password-for-timing")
	return h
}()
