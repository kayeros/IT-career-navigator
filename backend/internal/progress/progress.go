// Package progress — отметки «Изучено» по темам. Отметка общая для всех профессий, где есть тема.
package progress

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"careernav/internal/auth"
	"careernav/internal/httpx"
)

var errTopicNotFound = errors.New("тема не найдена")

// Handler — HTTP-часть модуля прогресса.
type Handler struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandler(pool *pgxpool.Pool, log *slog.Logger) *Handler {
	return &Handler{pool: pool, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	api.PUT("/topics/:id/progress", auth.RequireUser, h.mark)
	api.DELETE("/topics/:id/progress", auth.RequireUser, h.unmark)
}

func (h *Handler) mark(c *gin.Context) {
	h.handle(c, `INSERT INTO topic_progress (user_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`)
}

func (h *Handler) unmark(c *gin.Context) {
	h.handle(c, `DELETE FROM topic_progress WHERE user_id = $1 AND topic_id = $2`)
}

func (h *Handler) handle(c *gin.Context, query string) {
	topicID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || topicID <= 0 {
		httpx.NotFound(c)
		return
	}
	err = h.exec(c.Request.Context(), query, auth.CurrentUser(c).ID, topicID)
	if errors.Is(err, errTopicNotFound) {
		httpx.NotFound(c)
		return
	}
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) exec(ctx context.Context, query string, userID, topicID int64) error {
	var exists bool
	if err := h.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM topics WHERE id = $1)`, topicID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errTopicNotFound
	}
	_, err := h.pool.Exec(ctx, query, userID, topicID)
	return err
}
