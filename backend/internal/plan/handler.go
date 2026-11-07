package plan

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"careernav/internal/auth"
	"careernav/internal/httpx"
	"careernav/internal/match"
	"careernav/internal/profile"
)

var errNoPlan = errors.New("плана нет")

type TopicRef struct {
	ID    int64  `json:"id"`
	Slug  string `json:"slug"`
	Title string `json:"title"`
}

type ItemOut struct {
	ID        int64    `json:"id"`
	SortOrder int      `json:"sort_order"`
	Topic     TopicRef `json:"topic"`
	Hours     float64  `json:"hours"`
	WeekNo    int      `json:"week_no"`
	Status    string   `json:"status"`
	Studied   bool     `json:"studied"`
	Skills    []string `json:"skills"`
}

type Progress struct {
	StudiedHours float64 `json:"studied_hours"`
	TotalHours   float64 `json:"total_hours"`
	Percent      int     `json:"percent"`
}

type Plan struct {
	ID                 int64     `json:"id"`
	ProfessionSlug     string    `json:"profession_slug"`
	VersionNo          int       `json:"version_no"`
	BuiltBy            string    `json:"built_by"`
	CreatedAt          time.Time `json:"created_at"`
	HoursPerWeek       int       `json:"hours_per_week"`
	Deadline           *string   `json:"deadline"`
	TotalHours         float64   `json:"total_hours"`
	ReadyDate          string    `json:"ready_date"`
	Late               bool      `json:"late"`
	HoursPerWeekNeeded *int      `json:"hours_per_week_needed"`
	MatchBefore        *float64  `json:"match_before"`
	MatchAfter         *float64  `json:"match_after"`
	Progress           Progress  `json:"progress"`
	CurrentItemID      *int64    `json:"current_item_id"`
	Items              []ItemOut `json:"items"`
}

type Handler struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandler(pool *pgxpool.Pool, log *slog.Logger) *Handler {
	return &Handler{pool: pool, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	api.GET("/professions/:slug/plan", auth.RequireUser, h.get)
	api.POST("/professions/:slug/plan", auth.RequireUser, h.build)
}

func (h *Handler) fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, match.ErrNotFound):
		httpx.NotFound(c)
	case errors.Is(err, errNoPlan):
		httpx.Error(c, http.StatusNotFound, "not_found", "Плана пока нет — постройте его")
	default:
		httpx.Internal(c, h.log, err)
	}
}

func (h *Handler) get(c *gin.Context) {
	ctx := c.Request.Context()
	userID := auth.CurrentUser(c).ID
	pid, err := match.ProfessionID(ctx, h.pool, c.Param("slug"))
	if err != nil {
		h.fail(c, err)
		return
	}
	p, err := load(ctx, h.pool, userID, pid)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) build(c *gin.Context) {
	var in struct {
		HoursPerWeek *int    `json:"hours_per_week"`
		Deadline     *string `json:"deadline"`
	}
	if c.Request.ContentLength != 0 {
		if err := c.ShouldBindJSON(&in); err != nil {
			httpx.Validation(c, map[string]string{"body": "Некорректный JSON"})
			return
		}
	}
	ctx := c.Request.Context()
	userID := auth.CurrentUser(c).ID

	// Часы и дедлайн: из запроса, иначе из онбординга.
	prof, err := profile.Get(ctx, h.pool, userID)
	if err != nil {
		h.fail(c, err)
		return
	}
	hours := prof.HoursPerWeek
	if in.HoursPerWeek != nil {
		hours = in.HoursPerWeek
	}
	deadlineStr := prof.Deadline
	if in.Deadline != nil {
		deadlineStr = in.Deadline
		if *in.Deadline == "" {
			deadlineStr = nil
		}
	}
	errs := map[string]string{}
	if hours == nil {
		errs["hours_per_week"] = "Укажите, сколько часов в неделю готовы учиться (от 2 до 40)"
	} else if *hours < 2 || *hours > 40 {
		errs["hours_per_week"] = "Часов в неделю: от 2 до 40"
	}
	var deadline *time.Time
	if deadlineStr != nil {
		d, err := time.Parse(time.DateOnly, *deadlineStr)
		if err != nil {
			errs["deadline"] = "Дата в формате ГГГГ-ММ-ДД"
		}
		deadline = &d
	}
	if len(errs) > 0 {
		httpx.Validation(c, errs)
		return
	}

	var out *Plan
	err = pgx.BeginFunc(ctx, h.pool, func(tx pgx.Tx) error {
		pid, err := match.ProfessionID(ctx, tx, c.Param("slug"))
		if err != nil {
			return err
		}
		calc, err := match.Calculate(ctx, tx, pid, userID)
		if err != nil {
			return err
		}
		today := time.Now().UTC().Truncate(24 * time.Hour)
		b := Build(calc.Skills, *hours, deadline, today)
		if err := save(ctx, tx, userID, pid, calc, b, *hours, deadline); err != nil {
			return err
		}
		out, err = load(ctx, tx, userID, pid)
		return err
	})
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, out)
}

// save сохраняет новую версию плана; прежние версии остаются.
func save(ctx context.Context, tx pgx.Tx, userID, pid int64, calc *match.Calc, b Built, hours int, deadline *time.Time) error {
	var planID int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO plans (user_id, profession_id, status, hours_per_week, deadline) VALUES ($1, $2, 'active', $3, $4)
		ON CONFLICT (user_id, profession_id) DO UPDATE
		SET hours_per_week = EXCLUDED.hours_per_week, deadline = EXCLUDED.deadline, status = 'active'
		RETURNING id`, userID, pid, hours, deadline).Scan(&planID); err != nil {
		return err
	}
	var snapshotID, assessmentID *int64
	if calc.SnapshotID != 0 {
		snapshotID = &calc.SnapshotID
	}
	if ref, err := match.LastAssessment(ctx, tx, userID, pid); err != nil {
		return err
	} else if ref != nil {
		assessmentID = &ref.ID
	}
	var versionID int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO plan_versions (plan_id, version_no, built_by, snapshot_id, assessment_id, match_before, match_after, total_hours, ready_date)
		VALUES ($1, (SELECT coalesce(max(version_no), 0) + 1 FROM plan_versions WHERE plan_id = $1), 'algorithm', $2, $3, $4, $5, $6, $7)
		RETURNING id`, planID, snapshotID, assessmentID, b.MatchBefore, b.MatchAfter, b.TotalHours, b.ReadyDate).Scan(&versionID); err != nil {
		return err
	}
	for i, it := range b.Items {
		if _, err := tx.Exec(ctx, `
			INSERT INTO plan_items (plan_version_id, sort_order, item_type, topic_id, week_no, hours, status)
			VALUES ($1, $2, 'topic', $3, $4, $5, $6)`, versionID, i+1, it.TopicID, it.WeekNo, it.Hours, it.Status); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `UPDATE plans SET current_version_id = $2 WHERE id = $1`, planID, versionID)
	return err
}

// load читает текущую версию плана с живыми отметками «Изучено».
func load(ctx context.Context, q match.Querier, userID, pid int64) (*Plan, error) {
	p := &Plan{Items: []ItemOut{}}
	var versionID int64
	var deadline *time.Time
	var ready time.Time
	err := q.QueryRow(ctx, `
		SELECT pl.id, pr.slug, pv.id, pv.version_no, pv.built_by, pv.created_at, pl.hours_per_week, pl.deadline,
		       pv.total_hours::float8, pv.ready_date, pv.match_before::float8, pv.match_after::float8
		FROM plans pl
		JOIN professions pr ON pr.id = pl.profession_id
		JOIN plan_versions pv ON pv.id = pl.current_version_id
		WHERE pl.user_id = $1 AND pl.profession_id = $2`, userID, pid).
		Scan(&p.ID, &p.ProfessionSlug, &versionID, &p.VersionNo, &p.BuiltBy, &p.CreatedAt, &p.HoursPerWeek, &deadline,
			&p.TotalHours, &ready, &p.MatchBefore, &p.MatchAfter)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errNoPlan
	}
	if err != nil {
		return nil, err
	}
	p.ReadyDate = ready.Format(time.DateOnly)
	if deadline != nil {
		s := deadline.Format(time.DateOnly)
		p.Deadline = &s
		if ready.After(*deadline) {
			p.Late = true
			if left := time.Until(*deadline).Hours() / (24 * 7); left >= 1 {
				n := int(math.Ceil(p.TotalHours / math.Floor(left)))
				p.HoursPerWeekNeeded = &n
			}
		}
	}

	rows, err := q.Query(ctx, `
		SELECT pi.id, pi.sort_order, t.id, t.slug, t.title, pi.hours::float8, pi.week_no, pi.status,
		       EXISTS (SELECT 1 FROM topic_progress tp WHERE tp.user_id = $2 AND tp.topic_id = t.id),
		       coalesce(array(SELECT s.name FROM topic_skills ts
		                      JOIN profession_skills ps ON ps.skill_id = ts.skill_id AND ps.profession_id = $3 AND ps.is_key
		                      JOIN skills s ON s.id = ts.skill_id
		                      WHERE ts.topic_id = t.id ORDER BY s.name), '{}')
		FROM plan_items pi JOIN topics t ON t.id = pi.topic_id
		WHERE pi.plan_version_id = $1 ORDER BY pi.sort_order`, versionID, userID, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var it ItemOut
		if err := rows.Scan(&it.ID, &it.SortOrder, &it.Topic.ID, &it.Topic.Slug, &it.Topic.Title, &it.Hours,
			&it.WeekNo, &it.Status, &it.Studied, &it.Skills); err != nil {
			return nil, err
		}
		p.Progress.TotalHours += it.Hours
		if it.Studied {
			p.Progress.StudiedHours += it.Hours
		} else if p.CurrentItemID == nil && it.Status == "to_learn" {
			id := it.ID
			p.CurrentItemID = &id
		}
		p.Items = append(p.Items, it)
	}
	if p.Progress.TotalHours > 0 {
		p.Progress.Percent = int(math.Round(p.Progress.StudiedHours / p.Progress.TotalHours * 100))
	}
	return p, rows.Err()
}
