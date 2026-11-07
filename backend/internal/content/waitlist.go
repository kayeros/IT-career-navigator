package content

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"careernav/internal/auth"
	"careernav/internal/httpx"
)

// joinWaitlist — «Сообщить о запуске»: почта в лист ожидания профессии. Повтор — без ошибки.
func (h *Handler) joinWaitlist(c *gin.Context) {
	var in struct {
		ProfessionSlug string `json:"profession_slug"`
		Email          string `json:"email"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		httpx.Validation(c, map[string]string{"body": "Некорректный JSON"})
		return
	}
	user := auth.CurrentUser(c)
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if email == "" && user != nil {
		email = user.Email
	}
	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email {
		httpx.Validation(c, map[string]string{"email": "Укажите корректную почту"})
		return
	}
	var userID *int64
	if user != nil {
		userID = &user.ID
	}

	ctx := c.Request.Context()
	var pid int64
	err := h.catalog.pool.QueryRow(ctx, `SELECT id FROM professions WHERE slug = $1 AND status IN ('available', 'soon')`,
		in.ProfessionSlug).Scan(&pid)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.NotFound(c)
		return
	}
	if err == nil {
		_, err = h.catalog.pool.Exec(ctx, `
			INSERT INTO waitlist (profession_id, email, user_id) VALUES ($1, $2, $3)
			ON CONFLICT (profession_id, email) DO UPDATE SET user_id = coalesce(waitlist.user_id, EXCLUDED.user_id)`,
			pid, email, userID)
	}
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	c.Status(http.StatusNoContent)
}
