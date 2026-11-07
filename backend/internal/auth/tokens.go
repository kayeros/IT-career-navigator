package auth

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5"
)

// Одноразовые токены из писем: подтверждение почты и сброс пароля. В БД — только sha256-хеш.
const (
	tokenEmailVerify   = "email_verify"
	tokenPasswordReset = "password_reset"

	emailVerifyTTL   = 48 * time.Hour
	passwordResetTTL = time.Hour
	// resendPause — не чаще одного письма такого типа за это время.
	resendPause = 60 * time.Second
)

var (
	ErrInvalidToken    = errors.New("ссылка неверная, устарела или уже использована")
	ErrAlreadyVerified = errors.New("почта уже подтверждена")
)

// TooSoonError — письмо запрошено раньше, чем через resendPause.
type TooSoonError struct{ RetryAfter time.Duration }

func (e TooSoonError) Error() string { return "слишком частый запрос письма" }

func tokenTTL(kind string) time.Duration {
	if kind == tokenPasswordReset {
		return passwordResetTTL
	}
	return emailVerifyTTL
}

// issueToken гасит прежние неиспользованные токены этого типа и выдаёт новый.
func issueToken(ctx context.Context, tx pgx.Tx, userID int64, kind string) (string, error) {
	if _, err := tx.Exec(ctx, `
		UPDATE auth_tokens SET used_at = now()
		WHERE user_id = $1 AND type = $2 AND used_at IS NULL`, userID, kind); err != nil {
		return "", err
	}
	token, err := newToken()
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO auth_tokens (user_id, type, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
		userID, kind, hashToken(token), time.Now().Add(tokenTTL(kind)))
	return token, err
}

// sinceLastToken — сколько прошло с выдачи последнего токена (в схеме нет created_at: считаем от expires_at).
func sinceLastToken(ctx context.Context, tx pgx.Tx, userID int64, kind string) (time.Duration, bool, error) {
	var expires *time.Time
	err := tx.QueryRow(ctx, `SELECT max(expires_at) FROM auth_tokens WHERE user_id = $1 AND type = $2`, userID, kind).Scan(&expires)
	if err != nil || expires == nil {
		return 0, false, err
	}
	return time.Since(expires.Add(-tokenTTL(kind))), true, nil
}

// useToken находит действующий токен, помечает его использованным и возвращает пользователя.
func useToken(ctx context.Context, tx pgx.Tx, token, kind string) (int64, error) {
	var id, userID int64
	err := tx.QueryRow(ctx, `
		SELECT id, user_id FROM auth_tokens
		WHERE token_hash = $1 AND type = $2 AND used_at IS NULL AND expires_at > now()
		FOR UPDATE`, hashToken(token), kind).Scan(&id, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrInvalidToken
	}
	if err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, `UPDATE auth_tokens SET used_at = now() WHERE id = $1`, id)
	return userID, err
}

func (s *Service) link(path, token string) string {
	return s.publicURL + path + "?token=" + url.QueryEscape(token)
}

func (s *Service) sendVerifyEmail(ctx context.Context, to, token string) {
	body := "Чтобы подтвердить почту, откройте ссылку (действует 48 часов): " + s.link("/verify-email", token)
	if err := s.mailer.Send(ctx, to, "Подтвердите почту — Карьерный навигатор IT", body); err != nil {
		s.log.Error("не удалось отправить письмо подтверждения", "err", err)
	}
}

// VerifyEmail подтверждает почту по токену из письма.
func (s *Service) VerifyEmail(ctx context.Context, token string) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		userID, err := useToken(ctx, tx, token, tokenEmailVerify)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1`, userID)
		return err
	})
}

// ResendVerification отправляет новое письмо подтверждения вошедшему пользователю.
func (s *Service) ResendVerification(ctx context.Context, u *User) error {
	if u.EmailVerified {
		return ErrAlreadyVerified
	}
	var token string
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if since, ok, err := sinceLastToken(ctx, tx, u.ID, tokenEmailVerify); err != nil {
			return err
		} else if ok && since < resendPause {
			return TooSoonError{RetryAfter: resendPause - since}
		}
		var err error
		token, err = issueToken(ctx, tx, u.ID, tokenEmailVerify)
		return err
	})
	if err != nil {
		return err
	}
	s.sendVerifyEmail(ctx, u.Email, token)
	return nil
}

// RequestPasswordReset отправляет ссылку для смены пароля. Для неизвестной почты молча ничего не делает,
// частые повторы на одну почту тоже молча пропускает — ответ API от этого не меняется.
func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	var token string
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var userID int64
		err := tx.QueryRow(ctx, `SELECT id FROM users WHERE email = $1 AND status = 'active'`, email).Scan(&userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if since, ok, err := sinceLastToken(ctx, tx, userID, tokenPasswordReset); err != nil {
			return err
		} else if ok && since < resendPause {
			return nil
		}
		token, err = issueToken(ctx, tx, userID, tokenPasswordReset)
		return err
	})
	if err != nil || token == "" {
		return err
	}
	body := "Чтобы задать новый пароль, откройте ссылку (действует 1 час): " + s.link("/reset-password", token) +
		"\nЕсли вы не запрашивали смену пароля, просто проигнорируйте это письмо."
	if err := s.mailer.Send(ctx, email, "Смена пароля — Карьерный навигатор IT", body); err != nil {
		return fmt.Errorf("письмо для смены пароля: %w", err)
	}
	return nil
}

// ConfirmPasswordReset меняет пароль по токену и закрывает все сессии пользователя.
func (s *Service) ConfirmPasswordReset(ctx context.Context, token, password string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		userID, err := useToken(ctx, tx, token, tokenPasswordReset)
		if err != nil {
			return err
		}
		// Ссылка пришла на почту — значит, почта рабочая.
		if _, err := tx.Exec(ctx, `
			UPDATE users SET password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1`,
			userID, hash); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
		return err
	})
}
