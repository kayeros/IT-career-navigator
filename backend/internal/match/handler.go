package match

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"careernav/internal/auth"
	"careernav/internal/httpx"
)

// Handler — HTTP-часть процента соответствия и краткого отчёта.
type Handler struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandler(pool *pgxpool.Pool, log *slog.Logger) *Handler {
	return &Handler{pool: pool, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	api.GET("/professions/:slug/match", auth.RequireUser, h.match)
	api.GET("/professions/:slug/report", auth.RequireUser, h.report)
}

func (h *Handler) calc(c *gin.Context) (*Calc, bool) {
	ctx := c.Request.Context()
	pid, err := ProfessionID(ctx, h.pool, c.Param("slug"))
	if err == nil {
		var calc *Calc
		calc, err = Calculate(ctx, h.pool, pid, auth.CurrentUser(c).ID)
		if err == nil {
			return calc, true
		}
	}
	if errors.Is(err, ErrNotFound) {
		httpx.NotFound(c)
	} else {
		httpx.Internal(c, h.log, err)
	}
	return nil, false
}

func (h *Handler) match(c *gin.Context) {
	calc, ok := h.calc(c)
	if !ok {
		return
	}
	if calc.Snapshot == nil {
		c.JSON(http.StatusOK, Result{Missing: []MissingSkill{}})
		return
	}
	res := Compute(calc.Skills)
	res.Snapshot = calc.Snapshot
	c.JSON(http.StatusOK, res)
}

func (h *Handler) report(c *gin.Context) {
	calc, ok := h.calc(c)
	if !ok {
		return
	}
	r := BuildReport(calc)
	ref, err := LastAssessment(c.Request.Context(), h.pool, auth.CurrentUser(c).ID, calc.ProfessionID)
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	r.Assessment = ref
	c.JSON(http.StatusOK, r)
}

// LastAssessment — последняя завершённая оценка пользователя по профессии или nil.
func LastAssessment(ctx context.Context, q Querier, userID, professionID int64) (*AssessmentRef, error) {
	var ref AssessmentRef
	err := q.QueryRow(ctx, `
		SELECT id, completed_at FROM assessments
		WHERE user_id = $1 AND profession_id = $2 AND status = 'completed'
		ORDER BY completed_at DESC LIMIT 1`, userID, professionID).Scan(&ref.ID, &ref.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ref, nil
}
