// Package assessment — оценка навыков по ключевым навыкам профессии.
// Уровень: «не знаю» — 0, «базово» — 0,5, «уверенно» — 1 после верного проверочного вопроса, иначе 0,5.
// Итог пишется в user_skill_levels и действует во всех профессиях.
package assessment

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"careernav/internal/auth"
	"careernav/internal/httpx"
	"careernav/internal/match"
)

// RetakePause — повторная оценка по профессии не чаще раза в 7 дней.
const RetakePause = 7 * 24 * time.Hour

var (
	errNotFound  = errors.New("не найдено")
	errCompleted = errors.New("оценка уже завершена")
)

// tooSoonError — повторная оценка раньше срока.
type tooSoonError struct{ Next time.Time }

func (e tooSoonError) Error() string {
	return "слишком рано для повторной оценки"
}

// Level переводит ответ в уровень навыка (раздел 8.4 structure.md).
// checkPassed == nil — проверочного вопроса нет: «уверенно» без проверки засчитываем как «базово».
func Level(selfLevel string, checkPassed *bool) float64 {
	switch selfLevel {
	case "basic":
		return 0.5
	case "confident":
		if checkPassed != nil && *checkPassed {
			return 1
		}
		return 0.5
	default:
		return 0
	}
}

type Question struct {
	ID      int64    `json:"id"`
	Text    string   `json:"text"`
	Options []string `json:"options"`
	correct int
}

type Answer struct {
	SelfLevel   string  `json:"self_level"`
	Level       float64 `json:"level"`
	CheckPassed *bool   `json:"check_passed"`
}

type Skill struct {
	SkillID  int64     `json:"skill_id"`
	Name     string    `json:"name"`
	Question *Question `json:"question"`
	Answer   *Answer   `json:"answer"`
	weight   float64
}

type Assessment struct {
	ID             int64      `json:"id"`
	ProfessionSlug string     `json:"profession_slug"`
	Status         string     `json:"status"`
	StartedAt      time.Time  `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at"`
	Skills         []Skill    `json:"skills"`
	userID         int64
	professionID   int64
}

type Handler struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandler(pool *pgxpool.Pool, log *slog.Logger) *Handler {
	return &Handler{pool: pool, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	api.POST("/professions/:slug/assessments", auth.RequireUser, h.start)
	api.GET("/assessments/:id", auth.RequireUser, h.get)
	api.PUT("/assessments/:id/answers/:skill_id", auth.RequireUser, h.answer)
	api.POST("/assessments/:id/complete", auth.RequireUser, h.complete)
}

func (h *Handler) fail(c *gin.Context, err error) {
	var soon tooSoonError
	switch {
	case errors.Is(err, errNotFound), errors.Is(err, match.ErrNotFound):
		httpx.NotFound(c)
	case errors.Is(err, errCompleted):
		httpx.Error(c, http.StatusConflict, "completed", "Оценка уже завершена. Новую можно начать через 7 дней после прошлой.")
	case errors.As(err, &soon):
		httpx.Error(c, http.StatusConflict, "too_soon",
			fmt.Sprintf("Пройти оценку заново можно с %s", soon.Next.Format("02.01.2006")))
	default:
		httpx.Internal(c, h.log, err)
	}
}

// load читает оценку с навыками, вопросами и ответами. Чужую оценку не отдаёт.
func load(ctx context.Context, q match.Querier, id, userID int64) (*Assessment, error) {
	a := &Assessment{ID: id}
	err := q.QueryRow(ctx, `
		SELECT a.user_id, a.profession_id, p.slug, a.status, a.started_at, a.completed_at
		FROM assessments a JOIN professions p ON p.id = a.profession_id WHERE a.id = $1`, id).
		Scan(&a.userID, &a.professionID, &a.ProfessionSlug, &a.Status, &a.StartedAt, &a.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && a.userID != userID) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}

	// Навыки — ключевые навыки профессии; вес — из последнего снимка (для порядка: важные сначала).
	rows, err := q.Query(ctx, `
		SELECT s.id, s.name,
		       coalesce((SELECT w.weight FROM skill_weights w JOIN weight_snapshots ws ON ws.id = w.snapshot_id
		                 WHERE w.skill_id = s.id AND ws.profession_id = $1 AND ws.status = 'published'
		                 ORDER BY ws.period DESC LIMIT 1), 0)::float8,
		       q.id, q.question, q.options, q.correct_option,
		       aa.self_level, aa.level::float8, aa.check_passed
		FROM profession_skills ps
		JOIN skills s ON s.id = ps.skill_id
		LEFT JOIN LATERAL (SELECT * FROM check_questions cq WHERE cq.skill_id = s.id AND cq.active ORDER BY cq.id LIMIT 1) q ON true
		LEFT JOIN assessment_answers aa ON aa.assessment_id = $2 AND aa.skill_id = s.id
		WHERE ps.profession_id = $1 AND ps.is_key`, a.professionID, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s Skill
		var qid *int64
		var qtext *string
		var qopts []byte
		var qcorrect *int
		var self *string
		var level *float64
		var passed *bool
		if err := rows.Scan(&s.SkillID, &s.Name, &s.weight, &qid, &qtext, &qopts, &qcorrect, &self, &level, &passed); err != nil {
			return nil, err
		}
		if qid != nil {
			qu := &Question{ID: *qid, Text: *qtext, correct: *qcorrect}
			if err := json.Unmarshal(qopts, &qu.Options); err != nil {
				return nil, err
			}
			s.Question = qu
		}
		if self != nil {
			s.Answer = &Answer{SelfLevel: *self, Level: *level, CheckPassed: passed}
		}
		a.Skills = append(a.Skills, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(a.Skills, func(i, j int) bool {
		if a.Skills[i].weight != a.Skills[j].weight {
			return a.Skills[i].weight > a.Skills[j].weight
		}
		return a.Skills[i].Name < a.Skills[j].Name
	})
	if a.Skills == nil {
		a.Skills = []Skill{}
	}
	return a, nil
}

func (h *Handler) start(c *gin.Context) {
	ctx := c.Request.Context()
	userID := auth.CurrentUser(c).ID
	var a *Assessment
	created := false
	err := pgx.BeginFunc(ctx, h.pool, func(tx pgx.Tx) error {
		pid, err := match.ProfessionID(ctx, tx, c.Param("slug"))
		if err != nil {
			return err
		}
		// Одна оценка за раз: блокируем строку пользователя от параллельного старта.
		if _, err := tx.Exec(ctx, `SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, userID); err != nil {
			return err
		}
		var id int64
		err = tx.QueryRow(ctx, `
			SELECT id FROM assessments WHERE user_id = $1 AND profession_id = $2 AND status = 'in_progress'
			ORDER BY id DESC LIMIT 1`, userID, pid).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			var last *time.Time
			if err := tx.QueryRow(ctx, `
				SELECT max(completed_at) FROM assessments WHERE user_id = $1 AND profession_id = $2 AND status = 'completed'`,
				userID, pid).Scan(&last); err != nil {
				return err
			}
			if last != nil && time.Since(*last) < RetakePause {
				return tooSoonError{Next: last.Add(RetakePause)}
			}
			if err := tx.QueryRow(ctx, `
				INSERT INTO assessments (user_id, profession_id, status) VALUES ($1, $2, 'in_progress') RETURNING id`,
				userID, pid).Scan(&id); err != nil {
				return err
			}
			created = true
		} else if err != nil {
			return err
		}
		a, err = load(ctx, tx, id, userID)
		return err
	})
	if err != nil {
		h.fail(c, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	c.JSON(status, a)
}

func pathInt(c *gin.Context, name string) (int64, bool) {
	v, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || v <= 0 {
		httpx.NotFound(c)
		return 0, false
	}
	return v, true
}

func (h *Handler) get(c *gin.Context) {
	id, ok := pathInt(c, "id")
	if !ok {
		return
	}
	a, err := load(c.Request.Context(), h.pool, id, auth.CurrentUser(c).ID)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, a)
}

func (h *Handler) answer(c *gin.Context) {
	id, ok1 := pathInt(c, "id")
	skillID, ok2 := pathInt(c, "skill_id")
	if !ok1 || !ok2 {
		return
	}
	var in struct {
		SelfLevel   string `json:"self_level"`
		CheckOption *int   `json:"check_option"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		httpx.Validation(c, map[string]string{"body": "Некорректный JSON"})
		return
	}
	switch in.SelfLevel {
	case "none", "basic", "confident":
	default:
		httpx.Validation(c, map[string]string{"self_level": "Ответ: none, basic или confident"})
		return
	}

	ctx := c.Request.Context()
	var out *Skill
	var verr map[string]string
	err := pgx.BeginFunc(ctx, h.pool, func(tx pgx.Tx) error {
		a, err := load(ctx, tx, id, auth.CurrentUser(c).ID)
		if err != nil {
			return err
		}
		if a.Status == "completed" {
			return errCompleted
		}
		var sk *Skill
		for i := range a.Skills {
			if a.Skills[i].SkillID == skillID {
				sk = &a.Skills[i]
			}
		}
		if sk == nil {
			return errNotFound
		}

		var passed *bool
		if in.SelfLevel == "confident" && sk.Question != nil {
			// Проверочный вопрос засчитывается один раз: переответить, чтобы подобрать вариант, нельзя.
			if sk.Answer != nil && sk.Answer.CheckPassed != nil {
				passed = sk.Answer.CheckPassed
			} else {
				if in.CheckOption == nil || *in.CheckOption < 0 || *in.CheckOption >= len(sk.Question.Options) {
					verr = map[string]string{"check_option": "Ответьте на проверочный вопрос"}
					return nil
				}
				ok := *in.CheckOption == sk.Question.correct
				passed = &ok
			}
		} else if sk.Answer != nil && sk.Answer.CheckPassed != nil {
			passed = sk.Answer.CheckPassed // результат проверки сохраняем, даже если ответ сменили
		}
		level := Level(in.SelfLevel, passed)
		if _, err := tx.Exec(ctx, `
			INSERT INTO assessment_answers (assessment_id, skill_id, self_level, check_passed, level) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (assessment_id, skill_id) DO UPDATE
			SET self_level = EXCLUDED.self_level, check_passed = EXCLUDED.check_passed, level = EXCLUDED.level`,
			id, skillID, in.SelfLevel, passed, level); err != nil {
			return err
		}
		sk.Answer = &Answer{SelfLevel: in.SelfLevel, Level: level, CheckPassed: passed}
		out = sk
		return nil
	})
	if err != nil {
		h.fail(c, err)
		return
	}
	if verr != nil {
		httpx.Validation(c, verr)
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *Handler) complete(c *gin.Context) {
	id, ok := pathInt(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()
	userID := auth.CurrentUser(c).ID
	var report match.Report
	var left int
	err := pgx.BeginFunc(ctx, h.pool, func(tx pgx.Tx) error {
		a, err := load(ctx, tx, id, userID)
		if err != nil {
			return err
		}
		if a.Status == "completed" {
			return errCompleted
		}
		for _, s := range a.Skills {
			if s.Answer == nil {
				left++
			}
		}
		if left > 0 {
			return nil
		}
		// Уровень навыка общий для всех профессий: последняя оценка перезаписывает прежнюю.
		for _, s := range a.Skills {
			if _, err := tx.Exec(ctx, `
				INSERT INTO user_skill_levels (user_id, skill_id, level, source) VALUES ($1, $2, $3, 'assessment')
				ON CONFLICT (user_id, skill_id) DO UPDATE
				SET level = EXCLUDED.level, source = 'assessment', updated_at = now()`, userID, s.SkillID, s.Answer.Level); err != nil {
				return err
			}
		}
		calc, err := match.Calculate(ctx, tx, a.professionID, userID)
		if err != nil {
			return err
		}
		report = match.BuildReport(calc)
		var snapshotID *int64
		if calc.SnapshotID != 0 {
			snapshotID = &calc.SnapshotID
		}
		var completedAt time.Time
		if err := tx.QueryRow(ctx, `
			UPDATE assessments SET status = 'completed', completed_at = now(), snapshot_id = $2, match_percent = $3
			WHERE id = $1 RETURNING completed_at`, id, snapshotID, report.Percent).Scan(&completedAt); err != nil {
			return err
		}
		report.Assessment = &match.AssessmentRef{ID: id, CompletedAt: completedAt}
		return nil
	})
	if err != nil {
		h.fail(c, err)
		return
	}
	if left > 0 {
		httpx.Validation(c, map[string]string{"answers": fmt.Sprintf("Ответьте на все навыки: осталось %d", left)})
		return
	}
	c.JSON(http.StatusOK, report)
}
