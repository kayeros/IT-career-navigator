package admin

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"careernav/internal/auth"
	"careernav/internal/httpx"
)

// Handler — HTTP-часть админки.
type Handler struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewHandler(pool *pgxpool.Pool, log *slog.Logger) *Handler {
	return &Handler{pool: pool, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	g := api.Group("/admin", auth.RequireUser, auth.RequireAdmin)

	g.GET("/professions", h.listProfessions)
	g.POST("/professions", h.createProfession)
	g.PATCH("/professions/:id", h.updateProfession)
	g.GET("/professions/:id/blocks", h.listBlocks)
	g.POST("/professions/:id/blocks", h.createBlock)
	g.GET("/professions/:id/skills", h.listProfessionSkills)
	g.PUT("/professions/:id/skills", h.setProfessionSkills)

	g.PATCH("/blocks/:id", h.updateBlock)
	g.DELETE("/blocks/:id", h.deleteBlock)
	g.PUT("/blocks/:id/topics", h.setBlockTopics)

	g.GET("/topics", h.listTopics)
	g.POST("/topics", h.createTopic)
	g.PATCH("/topics/:id", h.updateTopic)
	g.PUT("/topics/:id/skills", h.setTopicSkills)
	g.PUT("/topics/:id/resources", h.setTopicResources)

	g.GET("/skills", h.listSkills)
	g.POST("/skills", h.createSkill)
	g.PATCH("/skills/:id", h.updateSkill)
	g.POST("/skills/:id/synonyms", h.addSynonym)
	g.DELETE("/synonyms/:id", h.deleteSynonym)

	g.GET("/resources", h.listResources)
	g.POST("/resources", h.createResource)
	g.PATCH("/resources/:id", h.updateResource)

	g.GET("/waitlist", h.listWaitlist)
	g.GET("/unknown-terms", h.listUnknownTerms)
	g.PATCH("/unknown-terms/:id", h.resolveUnknownTerm)
}

// ---------- общее ----------

func pathID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.NotFound(c)
		return 0, false
	}
	return id, true
}

func bind(c *gin.Context, v any) bool {
	if err := c.ShouldBindJSON(v); err != nil {
		httpx.Validation(c, map[string]string{"body": "Некорректный JSON"})
		return false
	}
	return true
}

// fail переводит ошибку в ответ API.
func (h *Handler) fail(c *gin.Context, err error) {
	var ve validationError
	var pgErr *pgconn.PgError
	switch {
	case errors.As(err, &ve):
		httpx.Validation(c, ve)
	case errors.Is(err, errNotFound):
		httpx.NotFound(c)
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		httpx.Error(c, http.StatusConflict, "conflict", "Такая запись уже есть (совпадает slug, название или синоним)")
	case errors.As(err, &pgErr) && pgErr.Code == "23503":
		httpx.Validation(c, map[string]string{"body": "Связанная запись не найдена"})
	case errors.As(err, &pgErr) && pgErr.Code == "23514":
		httpx.Validation(c, map[string]string{"body": "Недопустимое значение статуса или типа"})
	default:
		httpx.Internal(c, h.log, err)
	}
}

// tx выполняет изменение в транзакции и отвечает ошибкой, если что-то пошло не так.
func (h *Handler) tx(c *gin.Context, fn func(ctx context.Context, tx pgx.Tx, adminID int64) error) bool {
	ctx := c.Request.Context()
	err := pgx.BeginFunc(ctx, h.pool, func(tx pgx.Tx) error { return fn(ctx, tx, auth.CurrentUser(c).ID) })
	if err != nil {
		h.fail(c, err)
		return false
	}
	return true
}

func oneOf(v string, allowed ...string) bool {
	for _, a := range allowed {
		if v == a {
			return true
		}
	}
	return false
}

// ---------- профессии ----------

type professionInput struct {
	Slug        *string `json:"slug"`
	Title       *string `json:"title"`
	Description *string `json:"description"`
	ForWhom     *string `json:"for_whom"`
	Status      *string `json:"status"`
	SortOrder   *int    `json:"sort_order"`
}

func (in professionInput) fields(create bool) (map[string]any, error) {
	errs := validationError{}
	set := map[string]any{}
	if in.Slug != nil {
		if !slugRe.MatchString(*in.Slug) {
			errs["slug"] = "Только латиница в нижнем регистре, цифры и дефисы"
		}
		set["slug"] = *in.Slug
	} else if create {
		errs["slug"] = "Укажите slug"
	}
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			errs["title"] = "Укажите название"
		}
		set["title"] = strings.TrimSpace(*in.Title)
	} else if create {
		errs["title"] = "Укажите название"
	}
	if in.Description != nil {
		set["description"] = nullable(in.Description)
	}
	if in.ForWhom != nil {
		set["for_whom"] = nullable(in.ForWhom)
	}
	if in.Status != nil {
		if !oneOf(*in.Status, "available", "soon", "hidden") {
			errs["status"] = "Статус: available, soon или hidden"
		}
		set["status"] = *in.Status
	}
	if in.SortOrder != nil {
		set["sort_order"] = *in.SortOrder
	}
	if len(errs) > 0 {
		return nil, errs
	}
	return set, nil
}

func (h *Handler) listProfessions(c *gin.Context) {
	items, err := list[Profession](c.Request.Context(), h.pool, `SELECT `+professionCols+` FROM professions ORDER BY sort_order, id`)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) createProfession(c *gin.Context) {
	var in professionInput
	if !bind(c, &in) {
		return
	}
	set, err := in.fields(true)
	if err != nil {
		h.fail(c, err)
		return
	}
	var p *Profession
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		var id int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO professions (slug, title, description, for_whom, status, sort_order)
			VALUES ($1, $2, $3, $4, coalesce($5, 'soon'), coalesce($6, 0)) RETURNING id`,
			set["slug"], set["title"], set["description"], set["for_whom"], set["status"], set["sort_order"]).Scan(&id); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "profession", id, "create", set); err != nil {
			return err
		}
		p, err = getProfession(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusCreated, p)
	}
}

func (h *Handler) updateProfession(c *gin.Context) {
	id, okID := pathID(c)
	var in professionInput
	if !okID || !bind(c, &in) {
		return
	}
	set, err := in.fields(false)
	if err != nil {
		h.fail(c, err)
		return
	}
	var p *Profession
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if err := update(ctx, tx, "professions", id, set); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE professions SET updated_at = now() WHERE id = $1`, id); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "profession", id, "update", set); err != nil {
			return err
		}
		p, err = getProfession(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusOK, p)
	}
}

// ---------- блоки ----------

type blockInput struct {
	Title     *string `json:"title"`
	SortOrder *int    `json:"sort_order"`
}

func (h *Handler) listBlocks(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	if _, err := getProfession(ctx, h.pool, id); err != nil {
		h.fail(c, err)
		return
	}
	items, err := list[Block](ctx, h.pool, blockSelect+` WHERE b.profession_id = $1 ORDER BY b.sort_order, b.id`, id)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) createBlock(c *gin.Context) {
	profID, okID := pathID(c)
	var in blockInput
	if !okID || !bind(c, &in) {
		return
	}
	if in.Title == nil || strings.TrimSpace(*in.Title) == "" {
		h.fail(c, validationError{"title": "Укажите название блока"})
		return
	}
	var b *Block
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if _, err := getProfession(ctx, tx, profID); err != nil {
			return err
		}
		var id int64
		// Без sort_order блок встаёт в конец.
		if err := tx.QueryRow(ctx, `
			INSERT INTO blocks (profession_id, title, sort_order)
			VALUES ($1, $2, coalesce($3, (SELECT coalesce(max(sort_order), 0) + 1 FROM blocks WHERE profession_id = $1)))
			RETURNING id`, profID, strings.TrimSpace(*in.Title), in.SortOrder).Scan(&id); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "block", id, "create", in); err != nil {
			return err
		}
		var err error
		b, err = getBlock(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusCreated, b)
	}
}

func (h *Handler) updateBlock(c *gin.Context) {
	id, okID := pathID(c)
	var in blockInput
	if !okID || !bind(c, &in) {
		return
	}
	set := map[string]any{}
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			h.fail(c, validationError{"title": "Укажите название блока"})
			return
		}
		set["title"] = strings.TrimSpace(*in.Title)
	}
	if in.SortOrder != nil {
		set["sort_order"] = *in.SortOrder
	}
	var b *Block
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if err := update(ctx, tx, "blocks", id, set); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "block", id, "update", set); err != nil {
			return err
		}
		var err error
		b, err = getBlock(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusOK, b)
	}
}

func (h *Handler) deleteBlock(c *gin.Context) {
	id, okID := pathID(c)
	if !okID {
		return
	}
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		tag, err := tx.Exec(ctx, `DELETE FROM blocks WHERE id = $1`, id)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return errNotFound
		}
		return audit(ctx, tx, adminID, "block", id, "delete", nil)
	})
	if ok {
		c.Status(http.StatusNoContent)
	}
}

func (h *Handler) setBlockTopics(c *gin.Context) {
	id, okID := pathID(c)
	var in []struct {
		TopicID  int64 `json:"topic_id"`
		Optional bool  `json:"optional"`
	}
	if !okID || !bind(c, &in) {
		return
	}
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if _, err := getBlock(ctx, tx, id); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM block_topics WHERE block_id = $1`, id); err != nil {
			return err
		}
		seen := map[int64]bool{}
		for i, t := range in {
			if seen[t.TopicID] {
				return validationError{"topics": "Тема повторяется в блоке"}
			}
			seen[t.TopicID] = true
			if _, err := tx.Exec(ctx, `
				INSERT INTO block_topics (block_id, topic_id, sort_order, optional_for_junior) VALUES ($1, $2, $3, $4)`,
				id, t.TopicID, i+1, t.Optional); err != nil {
				return err
			}
		}
		return audit(ctx, tx, adminID, "block_topics", id, "update", in)
	})
	if ok {
		c.Status(http.StatusNoContent)
	}
}

// ---------- навыки профессии ----------

type professionSkill struct {
	SkillID int64  `json:"skill_id" db:"skill_id"`
	Name    string `json:"name" db:"name"`
	IsKey   bool   `json:"is_key" db:"is_key"`
}

func (h *Handler) listProfessionSkills(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	if _, err := getProfession(ctx, h.pool, id); err != nil {
		h.fail(c, err)
		return
	}
	items, err := list[professionSkill](ctx, h.pool, `
		SELECT ps.skill_id, s.name, ps.is_key FROM profession_skills ps JOIN skills s ON s.id = ps.skill_id
		WHERE ps.profession_id = $1 ORDER BY s.name`, id)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) setProfessionSkills(c *gin.Context) {
	id, okID := pathID(c)
	var in []professionSkill
	if !okID || !bind(c, &in) {
		return
	}
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if _, err := getProfession(ctx, tx, id); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM profession_skills WHERE profession_id = $1`, id); err != nil {
			return err
		}
		for _, s := range in {
			if _, err := tx.Exec(ctx, `
				INSERT INTO profession_skills (profession_id, skill_id, is_key) VALUES ($1, $2, $3)
				ON CONFLICT (profession_id, skill_id) DO UPDATE SET is_key = EXCLUDED.is_key`, id, s.SkillID, s.IsKey); err != nil {
				return err
			}
		}
		return audit(ctx, tx, adminID, "profession_skills", id, "update", in)
	})
	if ok {
		c.Status(http.StatusNoContent)
	}
}

// ---------- темы ----------

type topicInput struct {
	Slug        *string  `json:"slug"`
	Title       *string  `json:"title"`
	Description *string  `json:"description"`
	Hours       *float64 `json:"hours"`
}

func (h *Handler) listTopics(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	items, err := list[Topic](c.Request.Context(), h.pool,
		topicSelect+` WHERE $1 = '' OR t.title ILIKE '%' || $1 || '%' OR t.slug ILIKE '%' || $1 || '%' ORDER BY t.title`, q)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (in topicInput) fields(create bool) (map[string]any, error) {
	errs := validationError{}
	set := map[string]any{}
	if create {
		if in.Slug == nil || !slugRe.MatchString(*in.Slug) {
			errs["slug"] = "Только латиница в нижнем регистре, цифры и дефисы"
		} else {
			set["slug"] = *in.Slug
		}
	} else if in.Slug != nil {
		errs["slug"] = "slug темы менять нельзя: на него завязан прогресс пользователей"
	}
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			errs["title"] = "Укажите название"
		}
		set["title"] = strings.TrimSpace(*in.Title)
	} else if create {
		errs["title"] = "Укажите название"
	}
	if in.Description != nil {
		set["description"] = nullable(in.Description)
	}
	if in.Hours != nil {
		if *in.Hours < 0 || *in.Hours > 9999 {
			errs["hours"] = "Часы: от 0 до 9999"
		}
		set["hours"] = *in.Hours
	} else if create {
		errs["hours"] = "Укажите часы на изучение с нуля"
	}
	if len(errs) > 0 {
		return nil, errs
	}
	return set, nil
}

func (h *Handler) createTopic(c *gin.Context) {
	var in topicInput
	if !bind(c, &in) {
		return
	}
	set, err := in.fields(true)
	if err != nil {
		h.fail(c, err)
		return
	}
	var t *Topic
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		var id int64
		if err := tx.QueryRow(ctx, `INSERT INTO topics (slug, title, description, hours) VALUES ($1, $2, $3, $4) RETURNING id`,
			set["slug"], set["title"], set["description"], set["hours"]).Scan(&id); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "topic", id, "create", set); err != nil {
			return err
		}
		t, err = getTopic(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusCreated, t)
	}
}

func (h *Handler) updateTopic(c *gin.Context) {
	id, okID := pathID(c)
	var in topicInput
	if !okID || !bind(c, &in) {
		return
	}
	set, err := in.fields(false)
	if err != nil {
		h.fail(c, err)
		return
	}
	var t *Topic
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if err := update(ctx, tx, "topics", id, set); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE topics SET updated_at = now() WHERE id = $1`, id); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "topic", id, "update", set); err != nil {
			return err
		}
		t, err = getTopic(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusOK, t)
	}
}

type idList struct {
	IDs []int64 `json:"ids"`
}

// setLinks заменяет связи темы (навыки или материалы) на переданный список по порядку.
func (h *Handler) setLinks(c *gin.Context, table, col string, ordered bool) {
	id, okID := pathID(c)
	var in idList
	if !okID || !bind(c, &in) {
		return
	}
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if _, err := getTopic(ctx, tx, id); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM `+table+` WHERE topic_id = $1`, id); err != nil {
			return err
		}
		for i, v := range in.IDs {
			var err error
			if ordered {
				_, err = tx.Exec(ctx, `INSERT INTO `+table+` (topic_id, `+col+`, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, id, v, i+1)
			} else {
				_, err = tx.Exec(ctx, `INSERT INTO `+table+` (topic_id, `+col+`) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, v)
			}
			if err != nil {
				return err
			}
		}
		return audit(ctx, tx, adminID, table, id, "update", in)
	})
	if ok {
		c.Status(http.StatusNoContent)
	}
}

func (h *Handler) setTopicSkills(c *gin.Context) { h.setLinks(c, "topic_skills", "skill_id", false) }
func (h *Handler) setTopicResources(c *gin.Context) {
	h.setLinks(c, "topic_resources", "resource_id", true)
}

// ---------- навыки и синонимы ----------

type skillInput struct {
	Name          *string `json:"name"`
	Status        *string `json:"status"`
	ReviewComment *string `json:"review_comment"`
}

func (h *Handler) listSkills(c *gin.Context) {
	status := c.Query("status")
	items, err := list[Skill](c.Request.Context(), h.pool, skillSelect+` WHERE $1 = '' OR s.status = $1 ORDER BY s.name`, status)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (in skillInput) fields(create bool) (map[string]any, error) {
	errs := validationError{}
	set := map[string]any{}
	if in.Name != nil {
		if strings.TrimSpace(*in.Name) == "" {
			errs["name"] = "Укажите название навыка"
		}
		set["name"] = strings.TrimSpace(*in.Name)
	} else if create {
		errs["name"] = "Укажите название навыка"
	}
	if in.Status != nil {
		if !oneOf(*in.Status, "new", "in_review", "verified") {
			errs["status"] = "Статус: new, in_review или verified"
		}
		set["status"] = *in.Status
	}
	if in.ReviewComment != nil {
		set["review_comment"] = nullable(in.ReviewComment)
	}
	if len(errs) > 0 {
		return nil, errs
	}
	return set, nil
}

func (h *Handler) createSkill(c *gin.Context) {
	var in skillInput
	if !bind(c, &in) {
		return
	}
	set, err := in.fields(true)
	if err != nil {
		h.fail(c, err)
		return
	}
	var s *Skill
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		var id int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO skills (name, status, source, review_comment) VALUES ($1, coalesce($2, 'in_review'), 'manual', $3) RETURNING id`,
			set["name"], set["status"], set["review_comment"]).Scan(&id); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "skill", id, "create", set); err != nil {
			return err
		}
		s, err = getSkill(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusCreated, s)
	}
}

func (h *Handler) updateSkill(c *gin.Context) {
	id, okID := pathID(c)
	var in skillInput
	if !okID || !bind(c, &in) {
		return
	}
	set, err := in.fields(false)
	if err != nil {
		h.fail(c, err)
		return
	}
	var s *Skill
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if err := update(ctx, tx, "skills", id, set); err != nil {
			return err
		}
		// Решение по навыку фиксируем: кто и когда проверил.
		if in.Status != nil {
			if _, err := tx.Exec(ctx, `UPDATE skills SET reviewed_by = $2, reviewed_at = now() WHERE id = $1`, id, adminID); err != nil {
				return err
			}
		}
		if err := audit(ctx, tx, adminID, "skill", id, "update", set); err != nil {
			return err
		}
		s, err = getSkill(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusOK, s)
	}
}

func (h *Handler) addSynonym(c *gin.Context) {
	skillID, okID := pathID(c)
	var in struct {
		Synonym string `json:"synonym"`
	}
	if !okID || !bind(c, &in) {
		return
	}
	syn := strings.TrimSpace(in.Synonym)
	if syn == "" {
		h.fail(c, validationError{"synonym": "Укажите синоним"})
		return
	}
	var out Synonym
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if _, err := getSkill(ctx, tx, skillID); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `INSERT INTO skill_synonyms (skill_id, synonym) VALUES ($1, $2) RETURNING id, synonym::text`,
			skillID, syn).Scan(&out.ID, &out.Synonym); err != nil {
			return err
		}
		return audit(ctx, tx, adminID, "skill_synonym", out.ID, "create", map[string]any{"skill_id": skillID, "synonym": syn})
	})
	if ok {
		c.JSON(http.StatusCreated, out)
	}
}

func (h *Handler) deleteSynonym(c *gin.Context) {
	id, okID := pathID(c)
	if !okID {
		return
	}
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		var syn string
		err := tx.QueryRow(ctx, `DELETE FROM skill_synonyms WHERE id = $1 RETURNING synonym::text`, id).Scan(&syn)
		if errors.Is(err, pgx.ErrNoRows) {
			return errNotFound
		}
		if err != nil {
			return err
		}
		return audit(ctx, tx, adminID, "skill_synonym", id, "delete", map[string]any{"synonym": syn})
	})
	if ok {
		c.Status(http.StatusNoContent)
	}
}

// ---------- материалы ----------

type resourceInput struct {
	Title         *string `json:"title"`
	URL           *string `json:"url"`
	Type          *string `json:"type"`
	Language      *string `json:"language"`
	IsFree        *bool   `json:"is_free"`
	Status        *string `json:"status"`
	ReplacedByID  *int64  `json:"replaced_by_id"`
	ReviewComment *string `json:"review_comment"`
}

func (in resourceInput) fields(create bool) (map[string]any, error) {
	errs := validationError{}
	set := map[string]any{}
	req := func(name string, ok bool, msg string) {
		if create && !ok {
			errs[name] = msg
		}
	}
	if in.Title != nil {
		set["title"] = strings.TrimSpace(*in.Title)
	}
	req("title", in.Title != nil && strings.TrimSpace(*in.Title) != "", "Укажите название")
	if in.URL != nil {
		u, err := url.Parse(strings.TrimSpace(*in.URL))
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
			errs["url"] = "Укажите ссылку, начинающуюся с http:// или https://"
		}
		set["url"] = strings.TrimSpace(*in.URL)
	}
	req("url", in.URL != nil, "Укажите ссылку")
	if in.Type != nil {
		if !oneOf(*in.Type, "article", "video", "course", "docs", "practice") {
			errs["type"] = "Тип: article, video, course, docs или practice"
		}
		set["type"] = *in.Type
	}
	req("type", in.Type != nil, "Укажите тип материала")
	if in.Language != nil {
		set["language"] = strings.TrimSpace(*in.Language)
	}
	if in.IsFree != nil {
		set["is_free"] = *in.IsFree
	}
	req("is_free", in.IsFree != nil, "Укажите, бесплатный ли материал")
	if in.Status != nil {
		if !oneOf(*in.Status, "ai_suggested", "approved", "rejected", "replaced") {
			errs["status"] = "Статус: ai_suggested, approved, rejected или replaced"
		}
		if *in.Status == "replaced" && in.ReplacedByID == nil {
			errs["replaced_by_id"] = "Для замены укажите материал, которым заменяем"
		}
		set["status"] = *in.Status
	}
	if in.ReplacedByID != nil {
		set["replaced_by_id"] = *in.ReplacedByID
	}
	if in.ReviewComment != nil {
		set["review_comment"] = nullable(in.ReviewComment)
	}
	if len(errs) > 0 {
		return nil, errs
	}
	return set, nil
}

func (h *Handler) listResources(c *gin.Context) {
	status := c.Query("status")
	items, err := list[Resource](c.Request.Context(), h.pool,
		`SELECT `+resourceCols+` FROM resources WHERE $1 = '' OR status = $1 ORDER BY id DESC`, status)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) createResource(c *gin.Context) {
	var in resourceInput
	if !bind(c, &in) {
		return
	}
	set, err := in.fields(true)
	if err != nil {
		h.fail(c, err)
		return
	}
	var r *Resource
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		// Материал, добавленный командой, по умолчанию одобрен этим админом.
		var id int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO resources (title, url, type, language, is_free, status, review_comment, reviewed_by, reviewed_at)
			VALUES ($1, $2, $3, coalesce($4, 'ru'), $5, coalesce($6, 'approved'), $7, $8, now()) RETURNING id`,
			set["title"], set["url"], set["type"], set["language"], set["is_free"], set["status"], set["review_comment"], adminID).Scan(&id); err != nil {
			return err
		}
		if err := audit(ctx, tx, adminID, "resource", id, "create", set); err != nil {
			return err
		}
		r, err = getResource(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusCreated, r)
	}
}

func (h *Handler) updateResource(c *gin.Context) {
	id, okID := pathID(c)
	var in resourceInput
	if !okID || !bind(c, &in) {
		return
	}
	set, err := in.fields(false)
	if err != nil {
		h.fail(c, err)
		return
	}
	var r *Resource
	ok := h.tx(c, func(ctx context.Context, tx pgx.Tx, adminID int64) error {
		if err := update(ctx, tx, "resources", id, set); err != nil {
			return err
		}
		if in.Status != nil {
			if _, err := tx.Exec(ctx, `UPDATE resources SET reviewed_by = $2, reviewed_at = now() WHERE id = $1`, id, adminID); err != nil {
				return err
			}
		}
		if err := audit(ctx, tx, adminID, "resource", id, "update", set); err != nil {
			return err
		}
		r, err = getResource(ctx, tx, id)
		return err
	})
	if ok {
		c.JSON(http.StatusOK, r)
	}
}
