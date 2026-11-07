package content

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("не найдено")

type ProfessionSummary struct {
	Slug        string  `json:"slug"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
	ForWhom     *string `json:"for_whom"`
	Status      string  `json:"status"`
	BlocksCount int     `json:"blocks_count"`
	TopicsCount int     `json:"topics_count"`
}

type ProfessionDetail struct {
	ID          int64     `json:"-"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	ForWhom     *string   `json:"for_whom"`
	Status      string    `json:"status"`
	Progress    *Progress `json:"progress"`
	Blocks      []Block   `json:"blocks"`
}

type Progress struct {
	Studied int `json:"studied"`
	Total   int `json:"total"`
}

type Block struct {
	ID     int64   `json:"id"`
	Title  string  `json:"title"`
	Topics []Topic `json:"topics"`
}

type Topic struct {
	ID          int64      `json:"id"`
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Hours       float64    `json:"hours"`
	Optional    bool       `json:"optional"`
	Studied     bool       `json:"studied"`
	Resources   []Resource `json:"resources"`
}

type Resource struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	Type     string `json:"type"`
	Language string `json:"language"`
	IsFree   bool   `json:"is_free"`
}

// Catalog читает контент профессий.
type Catalog struct {
	pool *pgxpool.Pool
}

func NewCatalog(pool *pgxpool.Pool) *Catalog {
	return &Catalog{pool: pool}
}

// List возвращает видимые профессии (available и soon) по порядку показа.
func (c *Catalog) List(ctx context.Context) ([]ProfessionSummary, error) {
	rows, err := c.pool.Query(ctx, `
		SELECT p.slug, p.title, p.description, p.for_whom, p.status,
		       (SELECT count(*) FROM blocks b WHERE b.profession_id = p.id),
		       (SELECT count(DISTINCT bt.topic_id) FROM blocks b JOIN block_topics bt ON bt.block_id = b.id
		        WHERE b.profession_id = p.id)
		FROM professions p
		WHERE p.status IN ('available', 'soon')
		ORDER BY p.sort_order, p.id`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (ProfessionSummary, error) {
		var p ProfessionSummary
		err := r.Scan(&p.Slug, &p.Title, &p.Description, &p.ForWhom, &p.Status, &p.BlocksCount, &p.TopicsCount)
		return p, err
	})
}

// Get возвращает карточку профессии. userID = 0 — гость: без отметок и прогресса.
func (c *Catalog) Get(ctx context.Context, slug string, userID int64) (*ProfessionDetail, error) {
	p := &ProfessionDetail{Blocks: []Block{}}
	err := c.pool.QueryRow(ctx, `
		SELECT id, slug, title, description, for_whom, status FROM professions
		WHERE slug = $1 AND status IN ('available', 'soon')`, slug).
		Scan(&p.ID, &p.Slug, &p.Title, &p.Description, &p.ForWhom, &p.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := c.pool.Query(ctx, `
		SELECT b.id, b.title, t.id, t.slug, t.title, t.description, t.hours::float8, bt.optional_for_junior,
		       EXISTS (SELECT 1 FROM topic_progress tp WHERE tp.user_id = $2 AND tp.topic_id = t.id)
		FROM blocks b
		JOIN block_topics bt ON bt.block_id = b.id
		JOIN topics t ON t.id = bt.topic_id
		WHERE b.profession_id = $1
		ORDER BY b.sort_order, b.id, bt.sort_order, t.id`, p.ID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Темы собираем по указателям, чтобы потом дописать к ним материалы.
	topicRefs := map[int64][]*Topic{}
	for rows.Next() {
		var blockID int64
		var blockTitle string
		var t Topic
		if err := rows.Scan(&blockID, &blockTitle, &t.ID, &t.Slug, &t.Title, &t.Description, &t.Hours,
			&t.Optional, &t.Studied); err != nil {
			return nil, err
		}
		t.Resources = []Resource{}
		if n := len(p.Blocks); n == 0 || p.Blocks[n-1].ID != blockID {
			p.Blocks = append(p.Blocks, Block{ID: blockID, Title: blockTitle, Topics: []Topic{}})
		}
		b := &p.Blocks[len(p.Blocks)-1]
		b.Topics = append(b.Topics, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	studied := map[int64]bool{}
	for bi := range p.Blocks {
		for ti := range p.Blocks[bi].Topics {
			t := &p.Blocks[bi].Topics[ti]
			topicRefs[t.ID] = append(topicRefs[t.ID], t)
			studied[t.ID] = t.Studied
		}
	}
	if err := c.attachResources(ctx, topicRefs); err != nil {
		return nil, err
	}

	if userID != 0 {
		pr := &Progress{Total: len(studied)}
		for _, s := range studied {
			if s {
				pr.Studied++
			}
		}
		p.Progress = pr
	}
	return p, nil
}

// attachResources дописывает к темам одобренные материалы.
func (c *Catalog) attachResources(ctx context.Context, topics map[int64][]*Topic) error {
	if len(topics) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(topics))
	for id := range topics {
		ids = append(ids, id)
	}
	rows, err := c.pool.Query(ctx, `
		SELECT tr.topic_id, r.id, r.title, r.url, r.type, r.language, r.is_free
		FROM topic_resources tr JOIN resources r ON r.id = tr.resource_id
		WHERE tr.topic_id = ANY($1) AND r.status = 'approved'
		ORDER BY tr.topic_id, tr.sort_order, r.id`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var topicID int64
		var r Resource
		if err := rows.Scan(&topicID, &r.ID, &r.Title, &r.URL, &r.Type, &r.Language, &r.IsFree); err != nil {
			return err
		}
		for _, t := range topics[topicID] {
			t.Resources = append(t.Resources, r)
		}
	}
	return rows.Err()
}
