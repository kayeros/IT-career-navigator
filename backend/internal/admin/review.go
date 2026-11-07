package admin

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// Заявки «Сообщить о запуске» и разбор частых неизвестных терминов из вакансий.

type WaitlistEntry struct {
	ID             int64     `json:"id" db:"id"`
	ProfessionSlug string    `json:"profession_slug" db:"profession_slug"`
	Email          string    `json:"email" db:"email"`
	UserID         *int64    `json:"user_id" db:"user_id"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

func (h *Handler) listWaitlist(c *gin.Context) {
	items, err := list[WaitlistEntry](c.Request.Context(), h.pool, `
		SELECT w.id, p.slug AS profession_slug, w.email::text AS email, w.user_id, w.created_at
		FROM waitlist w JOIN professions p ON p.id = w.profession_id
		WHERE $1 = '' OR p.slug = $1 ORDER BY w.created_at DESC`, c.Query("profession_slug"))
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

type UnknownTerm struct {
	ID          int64     `json:"id" db:"id"`
	Term        string    `json:"term" db:"term"`
	Occurrences int       `json:"occurrences" db:"occurrences"`
	Status      string    `json:"status" db:"status"`
	SkillID     *int64    `json:"skill_id" db:"skill_id"`
	FirstSeenAt time.Time `json:"first_seen_at" db:"first_seen_at"`
	LastSeenAt  time.Time `json:"last_seen_at" db:"last_seen_at"`
}

const unknownCols = `id, term::text AS term, occurrences, status, skill_id, first_seen_at, last_seen_at`

func (h *Handler) listUnknownTerms(c *gin.Context) {
	items, err := list[UnknownTerm](c.Request.Context(), h.pool,
		`SELECT `+unknownCols+` FROM unknown_terms WHERE $1 = '' OR status = $1 ORDER BY occurrences DESC, term`, c.Query("status"))
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) resolveUnknownTerm(c *gin.Context) {
	id, okID := pathID(c)
	var in struct {
		Status  string `json:"status"`
		SkillID *int64 `json:"skill_id"`
	}
	if !okID || !bind(c, &in) {
		return
	}
	if !oneOf(in.Status, "new", "became_skill", "became_synonym", "ignored") {
		h.fail(c, validationError{"status": "Статус: became_skill, became_synonym, ignored или new"})
		return
	}
	if in.Status == "became_synonym" && in.SkillID == nil {
		h.fail(c, validationError{"skill_id": "Укажите навык, синонимом которого станет термин"})
		return
	}
	var out *UnknownTerm
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		var term string
		if err := tx.QueryRow(ctx, `SELECT term::text FROM unknown_terms WHERE id = $1 FOR UPDATE`, id).Scan(&term); err != nil {
			if err == pgx.ErrNoRows {
				return errNotFound
			}
			return err
		}
		skillID := in.SkillID
		switch in.Status {
		case "became_skill":
			// Новый навык из вакансий начинает со статуса new и проходит проверку командой.
			var sid int64
			if err := tx.QueryRow(ctx, `INSERT INTO skills (name, status, source) VALUES ($1, 'new', 'vacancies') RETURNING id`,
				term).Scan(&sid); err != nil {
				return err
			}
			skillID = &sid
			if err := audit(ctx, tx, adminID, "skill", sid, "create", map[string]any{"name": term, "from_unknown_term": id}); err != nil {
				return err
			}
		case "became_synonym":
			var synID int64
			if err := tx.QueryRow(ctx, `INSERT INTO skill_synonyms (skill_id, synonym) VALUES ($1, $2) RETURNING id`,
				*skillID, term).Scan(&synID); err != nil {
				return err
			}
			if err := audit(ctx, tx, adminID, "skill_synonym", synID, "create", map[string]any{"skill_id": *skillID, "synonym": term}); err != nil {
				return err
			}
		default:
			skillID = nil
		}
		if _, err := tx.Exec(ctx, `UPDATE unknown_terms SET status = $2, skill_id = $3 WHERE id = $1`, id, in.Status, skillID); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "unknown_term", id, "update", in); err != nil {
			return err
		}
		rows, _ := tx.Query(ctx, `SELECT `+unknownCols+` FROM unknown_terms WHERE id = $1`, id)
		var err error
		out, err = one(pgx.CollectRows(rows, pgx.RowToAddrOfStructByName[UnknownTerm]))
		return err
	})
	if ok {
		c.JSON(http.StatusOK, out)
	}
}
