package match

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrNotFound — профессии нет или она скрыта.
var ErrNotFound = errors.New("профессия не найдена")

// Querier — общее у пула и транзакции.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Calc — всё, из чего считаются процент, отчёт и план: снимок весов и ключевые навыки с уровнями.
type Calc struct {
	ProfessionID int64
	SnapshotID   int64 // 0 — опубликованного снимка нет
	Snapshot     *Snapshot
	Skills       []KeySkill
}

// ProfessionID находит видимую профессию по slug.
func ProfessionID(ctx context.Context, q Querier, slug string) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `SELECT id FROM professions WHERE slug = $1 AND status IN ('available', 'soon')`, slug).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	return id, err
}

// Calculate собирает данные для расчёта по профессии и пользователю.
func Calculate(ctx context.Context, q Querier, professionID, userID int64) (*Calc, error) {
	c := &Calc{ProfessionID: professionID}

	// Последний опубликованный снимок весов профессии (его пишет collector).
	var period time.Time
	snap := &Snapshot{}
	err := q.QueryRow(ctx, `
		SELECT id, period, vacancy_count, calculated_at FROM weight_snapshots
		WHERE profession_id = $1 AND status = 'published'
		ORDER BY period DESC, id DESC LIMIT 1`, professionID).
		Scan(&c.SnapshotID, &period, &snap.VacancyCount, &snap.CalculatedAt)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
	case err != nil:
		return nil, err
	default:
		snap.Period = period.Format(time.DateOnly)
		snap.Preliminary = snap.VacancyCount < MinVacancies
		c.Snapshot = snap
	}

	c.Skills, err = keySkills(ctx, q, professionID, c.SnapshotID, userID)
	return c, err
}

// keySkills читает ключевые навыки с весами, уровнем из оценки и темами профессии, закрывающими навык.
// Темы идут в порядке roadmap.
func keySkills(ctx context.Context, q Querier, professionID, snapshotID, userID int64) ([]KeySkill, error) {
	rows, err := q.Query(ctx, `
		WITH profession_topics AS (
			SELECT bt.topic_id, min(b.sort_order * 1000 + bt.sort_order) AS ord,
			       bool_and(bt.optional_for_junior) AS optional
			FROM blocks b JOIN block_topics bt ON bt.block_id = b.id
			WHERE b.profession_id = $1
			GROUP BY bt.topic_id
		)
		SELECT s.id, s.name, coalesce(w.weight, 0)::float8,
		       coalesce((SELECT level FROM user_skill_levels l
		                 WHERE l.user_id = $3 AND l.skill_id = s.id AND l.source = 'assessment'), 0)::float8,
		       t.id, t.slug, t.title, t.hours::float8, pt.ord, pt.optional,
		       EXISTS (SELECT 1 FROM topic_progress tp WHERE tp.user_id = $3 AND tp.topic_id = t.id)
		FROM profession_skills ps
		JOIN skills s ON s.id = ps.skill_id
		LEFT JOIN skill_weights w ON w.snapshot_id = $2 AND w.skill_id = s.id
		LEFT JOIN topic_skills ts ON ts.skill_id = s.id
		     AND ts.topic_id IN (SELECT topic_id FROM profession_topics)
		LEFT JOIN topics t ON t.id = ts.topic_id
		LEFT JOIN profession_topics pt ON pt.topic_id = t.id
		WHERE ps.profession_id = $1 AND ps.is_key
		ORDER BY s.id, pt.ord`, professionID, snapshotID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []KeySkill
	for rows.Next() {
		var s KeySkill
		var topicID, ord *int64
		var slug, title *string
		var hours *float64
		var optional *bool
		var studied bool
		if err := rows.Scan(&s.ID, &s.Name, &s.Weight, &s.AssessLevel, &topicID, &slug, &title, &hours, &ord, &optional, &studied); err != nil {
			return nil, err
		}
		if n := len(skills); n == 0 || skills[n-1].ID != s.ID {
			s.Topics = []TopicLink{}
			skills = append(skills, s)
		}
		if topicID != nil {
			last := &skills[len(skills)-1]
			last.Topics = append(last.Topics, TopicLink{
				ID: *topicID, Slug: *slug, Title: *title, Studied: studied,
				Hours: *hours, Order: int(*ord), Optional: *optional,
			})
		}
	}
	return skills, rows.Err()
}
