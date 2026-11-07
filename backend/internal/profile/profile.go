// Package profile — профиль и ответы онбординга (user_profiles).
package profile

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"careernav/internal/auth"
	"careernav/internal/httpx"
)

// Profile — ответ API. Поля null, пока онбординг не пройден.
type Profile struct {
	LearnerStatus       *string `json:"learner_status"`
	Course              *int    `json:"course"`
	HoursPerWeek        *int    `json:"hours_per_week"`
	Deadline            *string `json:"deadline"`
	MonthsLearning      *int    `json:"months_learning"`
	LearnedUnneeded     *bool   `json:"learned_unneeded"`
	OnboardingCompleted bool    `json:"onboarding_completed"`
}

// Get возвращает профиль пользователя (пустой, если записи нет).
func Get(ctx context.Context, q interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}, userID int64) (*Profile, error) {
	var p Profile
	var deadline *time.Time
	var completed *time.Time
	err := q.QueryRow(ctx, `
		SELECT learner_status, course, hours_per_week, deadline, months_learning, learned_unneeded, onboarding_completed_at
		FROM user_profiles WHERE user_id = $1`, userID).
		Scan(&p.LearnerStatus, &p.Course, &p.HoursPerWeek, &deadline, &p.MonthsLearning, &p.LearnedUnneeded, &completed)
	if errors.Is(err, pgx.ErrNoRows) {
		return &p, nil
	}
	if err != nil {
		return nil, err
	}
	if deadline != nil {
		s := deadline.Format(time.DateOnly)
		p.Deadline = &s
	}
	p.OnboardingCompleted = completed != nil
	return &p, nil
}

type Handler struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandler(pool *pgxpool.Pool, log *slog.Logger) *Handler {
	return &Handler{pool: pool, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	api.GET("/me/profile", auth.RequireUser, h.get)
	api.PUT("/me/profile", auth.RequireUser, h.put)
}

func (h *Handler) get(c *gin.Context) {
	p, err := Get(c.Request.Context(), h.pool, auth.CurrentUser(c).ID)
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

// field — значение поля из JSON: передано ли оно и какое (null допустим).
type field[T any] struct {
	Set   bool
	Value *T
}

func (f *field[T]) UnmarshalJSON(b []byte) error {
	f.Set = true
	if string(b) == "null" {
		return nil
	}
	var v T
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	f.Value = &v
	return nil
}

type input struct {
	LearnerStatus      field[string] `json:"learner_status"`
	Course             field[int]    `json:"course"`
	HoursPerWeek       field[int]    `json:"hours_per_week"`
	Deadline           field[string] `json:"deadline"`
	MonthsLearning     field[int]    `json:"months_learning"`
	LearnedUnneeded    field[bool]   `json:"learned_unneeded"`
	CompleteOnboarding bool          `json:"complete_onboarding"`
}

func (in input) validate() map[string]string {
	errs := map[string]string{}
	if v := in.LearnerStatus.Value; v != nil {
		switch *v {
		case "student", "graduate", "switcher", "other":
		default:
			errs["learner_status"] = "Статус: student, graduate, switcher или other"
		}
	}
	rng := func(name string, f field[int], lo, hi int, msg string) {
		if f.Value != nil && (*f.Value < lo || *f.Value > hi) {
			errs[name] = msg
		}
	}
	rng("course", in.Course, 1, 6, "Курс: от 1 до 6")
	rng("hours_per_week", in.HoursPerWeek, 2, 40, "Часов в неделю: от 2 до 40")
	rng("months_learning", in.MonthsLearning, 0, 240, "Месяцев: от 0 до 240")
	if v := in.Deadline.Value; v != nil {
		d, err := time.Parse(time.DateOnly, *v)
		if err != nil {
			errs["deadline"] = "Дата в формате ГГГГ-ММ-ДД"
		} else if d.Before(time.Now().Truncate(24 * time.Hour)) {
			errs["deadline"] = "Дедлайн не может быть в прошлом"
		}
	}
	return errs
}

func (h *Handler) put(c *gin.Context) {
	var in input
	if err := c.ShouldBindJSON(&in); err != nil {
		httpx.Validation(c, map[string]string{"body": "Некорректный JSON"})
		return
	}
	if errs := in.validate(); len(errs) > 0 {
		httpx.Validation(c, errs)
		return
	}
	ctx := c.Request.Context()
	userID := auth.CurrentUser(c).ID
	err := pgx.BeginFunc(ctx, h.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, userID); err != nil {
			return err
		}
		// Колонки фиксированы кодом; меняем только переданные поля.
		sets := []struct {
			col string
			set bool
			val any
		}{
			{"learner_status", in.LearnerStatus.Set, in.LearnerStatus.Value},
			{"course", in.Course.Set, in.Course.Value},
			{"hours_per_week", in.HoursPerWeek.Set, in.HoursPerWeek.Value},
			{"deadline", in.Deadline.Set, in.Deadline.Value},
			{"months_learning", in.MonthsLearning.Set, in.MonthsLearning.Value},
			{"learned_unneeded", in.LearnedUnneeded.Set, in.LearnedUnneeded.Value},
		}
		for _, s := range sets {
			if !s.set {
				continue
			}
			if _, err := tx.Exec(ctx, `UPDATE user_profiles SET `+s.col+` = $2 WHERE user_id = $1`, userID, s.val); err != nil {
				return err
			}
		}
		if in.CompleteOnboarding {
			if _, err := tx.Exec(ctx, `
				UPDATE user_profiles SET onboarding_completed_at = coalesce(onboarding_completed_at, now()) WHERE user_id = $1`, userID); err != nil {
				return err
			}
		}
		_, err := tx.Exec(ctx, `UPDATE user_profiles SET updated_at = now() WHERE user_id = $1`, userID)
		return err
	})
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	h.get(c)
}
