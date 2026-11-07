// Package admin — API админки контента: профессии, блоки, темы, навыки, синонимы, материалы.
// Доступ только у роли admin; каждое изменение пишется в audit_log.
package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	errNotFound = errors.New("не найдено")
	slugRe      = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
)

// validationError — ошибки по полям формы (ответ 400).
type validationError map[string]string

func (v validationError) Error() string { return "ошибка в данных" }

// querier — общее у пула и транзакции.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// update меняет только переданные колонки. Имена колонок задаёт код, не пользователь.
func update(ctx context.Context, tx pgx.Tx, table string, id int64, set map[string]any) error {
	if len(set) == 0 {
		var exists bool
		if err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT EXISTS (SELECT 1 FROM %s WHERE id = $1)`, table), id).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return errNotFound
		}
		return nil
	}
	parts := make([]string, 0, len(set))
	args := []any{id}
	for col, v := range set {
		args = append(args, v)
		parts = append(parts, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	tag, err := tx.Exec(ctx, fmt.Sprintf(`UPDATE %s SET %s WHERE id = $1`, table, strings.Join(parts, ", ")), args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

// audit записывает изменение в журнал: кто, что и с какими данными.
func audit(ctx context.Context, tx pgx.Tx, adminID int64, entity string, entityID int64, action string, diff any) error {
	raw, err := json.Marshal(diff)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_log (admin_id, entity, entity_id, action, diff) VALUES ($1, $2, $3, $4, $5)`,
		adminID, entity, entityID, action, raw)
	return err
}

// nullable: пустая строка очищает поле (NULL).
func nullable(s *string) any {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return strings.TrimSpace(*s)
}

// ---------- ответы ----------

type Profession struct {
	ID          int64   `json:"id" db:"id"`
	Slug        string  `json:"slug" db:"slug"`
	Title       string  `json:"title" db:"title"`
	Description *string `json:"description" db:"description"`
	ForWhom     *string `json:"for_whom" db:"for_whom"`
	Status      string  `json:"status" db:"status"`
	SortOrder   int     `json:"sort_order" db:"sort_order"`
}

const professionCols = `id, slug, title, description, for_whom, status, sort_order`

func getProfession(ctx context.Context, q querier, id int64) (*Profession, error) {
	rows, _ := q.Query(ctx, `SELECT `+professionCols+` FROM professions WHERE id = $1`, id)
	return one(pgx.CollectRows(rows, pgx.RowToAddrOfStructByName[Profession]))
}

type BlockTopic struct {
	ID       int64  `json:"id"`
	Slug     string `json:"slug"`
	Title    string `json:"title"`
	Optional bool   `json:"optional"`
}

type Block struct {
	ID        int64        `json:"id" db:"id"`
	Title     string       `json:"title" db:"title"`
	SortOrder int          `json:"sort_order" db:"sort_order"`
	Topics    []BlockTopic `json:"topics" db:"topics"`
}

const blockSelect = `
	SELECT b.id, b.title, b.sort_order,
	       coalesce((SELECT json_agg(json_build_object('id', t.id, 'slug', t.slug, 'title', t.title,
	                                                   'optional', bt.optional_for_junior) ORDER BY bt.sort_order, t.id)
	                 FROM block_topics bt JOIN topics t ON t.id = bt.topic_id WHERE bt.block_id = b.id), '[]') AS topics
	FROM blocks b`

func getBlock(ctx context.Context, q querier, id int64) (*Block, error) {
	rows, _ := q.Query(ctx, blockSelect+` WHERE b.id = $1`, id)
	return one(pgx.CollectRows(rows, pgx.RowToAddrOfStructByName[Block]))
}

type Topic struct {
	ID          int64   `json:"id" db:"id"`
	Slug        string  `json:"slug" db:"slug"`
	Title       string  `json:"title" db:"title"`
	Description *string `json:"description" db:"description"`
	Hours       float64 `json:"hours" db:"hours"`
	SkillIDs    []int64 `json:"skill_ids" db:"skill_ids"`
	ResourceIDs []int64 `json:"resource_ids" db:"resource_ids"`
}

const topicSelect = `
	SELECT t.id, t.slug, t.title, t.description, t.hours::float8 AS hours,
	       coalesce(array(SELECT skill_id FROM topic_skills WHERE topic_id = t.id ORDER BY skill_id), '{}') AS skill_ids,
	       coalesce(array(SELECT resource_id FROM topic_resources WHERE topic_id = t.id ORDER BY sort_order, resource_id), '{}') AS resource_ids
	FROM topics t`

func getTopic(ctx context.Context, q querier, id int64) (*Topic, error) {
	rows, _ := q.Query(ctx, topicSelect+` WHERE t.id = $1`, id)
	return one(pgx.CollectRows(rows, pgx.RowToAddrOfStructByName[Topic]))
}

type Synonym struct {
	ID      int64  `json:"id"`
	Synonym string `json:"synonym"`
}

type Skill struct {
	ID            int64      `json:"id" db:"id"`
	Name          string     `json:"name" db:"name"`
	Status        string     `json:"status" db:"status"`
	Source        string     `json:"source" db:"source"`
	ReviewComment *string    `json:"review_comment" db:"review_comment"`
	ReviewedAt    *time.Time `json:"reviewed_at" db:"reviewed_at"`
	Synonyms      []Synonym  `json:"synonyms" db:"synonyms"`
}

const skillSelect = `
	SELECT s.id, s.name, s.status, s.source, s.review_comment, s.reviewed_at,
	       coalesce((SELECT json_agg(json_build_object('id', ss.id, 'synonym', ss.synonym) ORDER BY ss.synonym)
	                 FROM skill_synonyms ss WHERE ss.skill_id = s.id), '[]') AS synonyms
	FROM skills s`

func getSkill(ctx context.Context, q querier, id int64) (*Skill, error) {
	rows, _ := q.Query(ctx, skillSelect+` WHERE s.id = $1`, id)
	return one(pgx.CollectRows(rows, pgx.RowToAddrOfStructByName[Skill]))
}

type Resource struct {
	ID            int64      `json:"id" db:"id"`
	Title         string     `json:"title" db:"title"`
	URL           string     `json:"url" db:"url"`
	Type          string     `json:"type" db:"type"`
	Language      string     `json:"language" db:"language"`
	IsFree        bool       `json:"is_free" db:"is_free"`
	Status        string     `json:"status" db:"status"`
	ReplacedByID  *int64     `json:"replaced_by_id" db:"replaced_by_id"`
	ReviewComment *string    `json:"review_comment" db:"review_comment"`
	ReviewedAt    *time.Time `json:"reviewed_at" db:"reviewed_at"`
}

const resourceCols = `id, title, url, type, language, is_free, status, replaced_by_id, review_comment, reviewed_at`

func getResource(ctx context.Context, q querier, id int64) (*Resource, error) {
	rows, _ := q.Query(ctx, `SELECT `+resourceCols+` FROM resources WHERE id = $1`, id)
	return one(pgx.CollectRows(rows, pgx.RowToAddrOfStructByName[Resource]))
}

func one[T any](items []*T, err error) (*T, error) {
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, errNotFound
	}
	return items[0], nil
}

func list[T any](ctx context.Context, q querier, sql string, args ...any) ([]T, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	items, err := pgx.CollectRows(rows, pgx.RowToStructByName[T])
	if items == nil {
		items = []T{}
	}
	return items, err
}
