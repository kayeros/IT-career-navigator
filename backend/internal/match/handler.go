package match

import (
	"context"
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

var errNotFound = errors.New("профессия не найдена")

// Handler — HTTP-часть процента соответствия.
type Handler struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandler(pool *pgxpool.Pool, log *slog.Logger) *Handler {
	return &Handler{pool: pool, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	api.GET("/professions/:slug/match", auth.RequireUser, h.get)
}

func (h *Handler) get(c *gin.Context) {
	res, err := h.load(c.Request.Context(), c.Param("slug"), auth.CurrentUser(c).ID)
	if errors.Is(err, errNotFound) {
		httpx.NotFound(c)
		return
	}
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) load(ctx context.Context, slug string, userID int64) (*Result, error) {
	var professionID int64
	err := h.pool.QueryRow(ctx, `SELECT id FROM professions WHERE slug = $1 AND status IN ('available', 'soon')`, slug).
		Scan(&professionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}

	// Последний опубликованный снимок весов профессии (его пишет collector).
	var snapshotID int64
	var period time.Time
	snap := &Snapshot{}
	err = h.pool.QueryRow(ctx, `
		SELECT id, period, vacancy_count, calculated_at FROM weight_snapshots
		WHERE profession_id = $1 AND status = 'published'
		ORDER BY period DESC, id DESC LIMIT 1`, professionID).
		Scan(&snapshotID, &period, &snap.VacancyCount, &snap.CalculatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return &Result{Missing: []MissingSkill{}}, nil
	}
	if err != nil {
		return nil, err
	}
	snap.Period = period.Format(time.DateOnly)
	snap.Preliminary = snap.VacancyCount < MinVacancies

	skills, err := h.keySkills(ctx, professionID, snapshotID, userID)
	if err != nil {
		return nil, err
	}
	res := Compute(skills)
	res.Snapshot = snap
	return &res, nil
}

// keySkills читает ключевые навыки с весами и темы профессии, закрывающие каждый навык.
func (h *Handler) keySkills(ctx context.Context, professionID, snapshotID, userID int64) ([]KeySkill, error) {
	rows, err := h.pool.Query(ctx, `
		WITH profession_topics AS (
			SELECT bt.topic_id, min(b.sort_order * 1000 + bt.sort_order) AS ord
			FROM blocks b JOIN block_topics bt ON bt.block_id = b.id
			WHERE b.profession_id = $1
			GROUP BY bt.topic_id
		)
		SELECT s.id, s.name, coalesce(w.weight, 0)::float8,
		       t.id, t.slug, t.title,
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
		var topicID *int64
		var topicSlug, topicTitle *string
		var studied bool
		if err := rows.Scan(&s.ID, &s.Name, &s.Weight, &topicID, &topicSlug, &topicTitle, &studied); err != nil {
			return nil, err
		}
		if n := len(skills); n == 0 || skills[n-1].ID != s.ID {
			s.Topics = []TopicLink{}
			skills = append(skills, s)
		}
		if topicID != nil {
			last := &skills[len(skills)-1]
			last.Topics = append(last.Topics, TopicLink{ID: *topicID, Slug: *topicSlug, Title: *topicTitle, Studied: studied})
		}
	}
	return skills, rows.Err()
}
