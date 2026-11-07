// Package content отвечает за контент профессий: каталог, карточку и загрузку seed-черновика.
package content

import (
	"context"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gopkg.in/yaml.v3"
)

const (
	skillDraftComment    = "черновик, проверить Рустаму"
	resourceDraftComment = "черновик, проверить Алику"
)

// SeedData — разобранные и проверенные YAML-файлы seed.
type SeedData struct {
	Skills      []seedSkill
	Topics      []seedTopic
	Professions []seedProfession
}

type seedSkill struct {
	Name     string   `yaml:"name"`
	Synonyms []string `yaml:"synonyms"`
}

type seedResource struct {
	Title    string `yaml:"title"`
	URL      string `yaml:"url"`
	Type     string `yaml:"type"`
	Language string `yaml:"language"`
}

type seedTopic struct {
	Slug        string         `yaml:"slug"`
	Title       string         `yaml:"title"`
	Description string         `yaml:"description"`
	Hours       float64        `yaml:"hours"`
	Skills      []string       `yaml:"skills"`
	Resources   []seedResource `yaml:"resources"`
}

// seedBlockTopic записывается в YAML строкой (slug) или объектом {slug, optional}.
type seedBlockTopic struct {
	Slug     string
	Optional bool
}

func (t *seedBlockTopic) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind == yaml.ScalarNode {
		t.Slug = n.Value
		return nil
	}
	var v struct {
		Slug     string `yaml:"slug"`
		Optional bool   `yaml:"optional"`
	}
	if err := n.Decode(&v); err != nil {
		return err
	}
	t.Slug, t.Optional = v.Slug, v.Optional
	return nil
}

type seedBlock struct {
	Title  string           `yaml:"title"`
	Topics []seedBlockTopic `yaml:"topics"`
}

type seedProfession struct {
	Slug        string      `yaml:"slug"`
	Title       string      `yaml:"title"`
	Description string      `yaml:"description"`
	ForWhom     string      `yaml:"for_whom"`
	SortOrder   int         `yaml:"sort_order"`
	KeySkills   []string    `yaml:"key_skills"`
	Topics      []seedTopic `yaml:"topics"`
	Blocks      []seedBlock `yaml:"blocks"`
}

// LoadSeed читает YAML из каталога dir и проверяет его согласованность.
func LoadSeed(fsys fs.FS, dir string) (*SeedData, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, err
	}

	data := &SeedData{}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".yaml") {
			continue
		}
		raw, err := fs.ReadFile(fsys, path.Join(dir, name))
		if err != nil {
			return nil, err
		}
		switch name {
		case "skills.yaml":
			var f struct {
				Skills []seedSkill `yaml:"skills"`
			}
			if err := yaml.Unmarshal(raw, &f); err != nil {
				return nil, fmt.Errorf("%s: %w", name, err)
			}
			data.Skills = f.Skills
		case "topics-shared.yaml":
			var f struct {
				Topics []seedTopic `yaml:"topics"`
			}
			if err := yaml.Unmarshal(raw, &f); err != nil {
				return nil, fmt.Errorf("%s: %w", name, err)
			}
			data.Topics = append(data.Topics, f.Topics...)
		default:
			var p seedProfession
			if err := yaml.Unmarshal(raw, &p); err != nil {
				return nil, fmt.Errorf("%s: %w", name, err)
			}
			data.Topics = append(data.Topics, p.Topics...)
			data.Professions = append(data.Professions, p)
		}
	}
	sort.Slice(data.Professions, func(i, j int) bool {
		return data.Professions[i].SortOrder < data.Professions[j].SortOrder
	})

	if err := data.validate(); err != nil {
		return nil, err
	}
	return data, nil
}

// validate ловит ошибки правки контента до записи в базу.
func (d *SeedData) validate() error {
	skills := map[string]bool{}
	terms := map[string]string{}
	for _, s := range d.Skills {
		if skills[s.Name] {
			return fmt.Errorf("навык %q объявлен дважды", s.Name)
		}
		skills[s.Name] = true
		for _, term := range append([]string{s.Name}, s.Synonyms...) {
			key := strings.ToLower(term)
			if owner, ok := terms[key]; ok && owner != s.Name {
				return fmt.Errorf("синоним %q есть у навыков %q и %q", term, owner, s.Name)
			}
			terms[key] = s.Name
		}
	}

	topics := map[string]seedTopic{}
	for _, t := range d.Topics {
		if _, ok := topics[t.Slug]; ok {
			return fmt.Errorf("тема %q объявлена дважды", t.Slug)
		}
		topics[t.Slug] = t
		for _, s := range t.Skills {
			if !skills[s] {
				return fmt.Errorf("тема %q: нет навыка %q в skills.yaml", t.Slug, s)
			}
		}
	}

	for _, p := range d.Professions {
		covered := map[string]bool{}
		count := 0
		for _, b := range p.Blocks {
			for _, bt := range b.Topics {
				t, ok := topics[bt.Slug]
				if !ok {
					return fmt.Errorf("%s: блок %q ссылается на неизвестную тему %q", p.Slug, b.Title, bt.Slug)
				}
				count++
				for _, s := range t.Skills {
					covered[s] = true
				}
			}
		}
		if n := len(p.Blocks); n < 4 || n > 6 {
			return fmt.Errorf("%s: блоков %d, нужно 4–6", p.Slug, n)
		}
		if count < 15 || count > 25 {
			return fmt.Errorf("%s: тем %d, нужно 15–25", p.Slug, count)
		}
		if n := len(p.KeySkills); n < 15 || n > 25 {
			return fmt.Errorf("%s: ключевых навыков %d, нужно 15–25", p.Slug, n)
		}
		for _, s := range p.KeySkills {
			if !skills[s] {
				return fmt.Errorf("%s: нет навыка %q в skills.yaml", p.Slug, s)
			}
			if !covered[s] {
				return fmt.Errorf("%s: ключевой навык %q не закрывается ни одной темой", p.Slug, s)
			}
		}
	}
	return nil
}

// ApplySeed записывает seed в базу одной транзакцией. Повторный запуск не создаёт дублей:
// состав блоков, связи тем и ключевые навыки профессий приводятся к состоянию из YAML.
func ApplySeed(ctx context.Context, pool *pgxpool.Pool, d *SeedData) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		skillIDs := map[string]int64{}
		for _, s := range d.Skills {
			var id int64
			err := tx.QueryRow(ctx, `
				INSERT INTO skills (name, status, source, review_comment)
				VALUES ($1, 'in_review', 'manual', $2)
				ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
				RETURNING id`, s.Name, skillDraftComment).Scan(&id)
			if err != nil {
				return fmt.Errorf("навык %q: %w", s.Name, err)
			}
			skillIDs[s.Name] = id
			for _, syn := range s.Synonyms {
				_, err := tx.Exec(ctx, `
					INSERT INTO skill_synonyms (skill_id, synonym) VALUES ($1, $2)
					ON CONFLICT (synonym) DO UPDATE SET skill_id = EXCLUDED.skill_id`, id, syn)
				if err != nil {
					return fmt.Errorf("синоним %q: %w", syn, err)
				}
			}
		}

		topicIDs := map[string]int64{}
		for _, t := range d.Topics {
			id, err := applyTopic(ctx, tx, t, skillIDs)
			if err != nil {
				return fmt.Errorf("тема %q: %w", t.Slug, err)
			}
			topicIDs[t.Slug] = id
		}

		for _, p := range d.Professions {
			if err := applyProfession(ctx, tx, p, skillIDs, topicIDs); err != nil {
				return fmt.Errorf("профессия %q: %w", p.Slug, err)
			}
		}
		return nil
	})
}

func applyTopic(ctx context.Context, tx pgx.Tx, t seedTopic, skillIDs map[string]int64) (int64, error) {
	var id int64
	err := tx.QueryRow(ctx, `
		INSERT INTO topics (slug, title, description, hours) VALUES ($1, $2, $3, $4)
		ON CONFLICT (slug) DO UPDATE
		SET title = EXCLUDED.title, description = EXCLUDED.description, hours = EXCLUDED.hours, updated_at = now()
		RETURNING id`, t.Slug, t.Title, t.Description, t.Hours).Scan(&id)
	if err != nil {
		return 0, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM topic_skills WHERE topic_id = $1`, id); err != nil {
		return 0, err
	}
	for _, s := range t.Skills {
		if _, err := tx.Exec(ctx, `INSERT INTO topic_skills (topic_id, skill_id) VALUES ($1, $2)`, id, skillIDs[s]); err != nil {
			return 0, err
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM topic_resources WHERE topic_id = $1`, id); err != nil {
		return 0, err
	}
	for i, r := range t.Resources {
		resourceID, err := applyResource(ctx, tx, r)
		if err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO topic_resources (topic_id, resource_id, sort_order) VALUES ($1, $2, $3)`,
			id, resourceID, i+1); err != nil {
			return 0, err
		}
	}
	return id, nil
}

// applyResource находит материал по URL (уникального ключа в схеме нет) или создаёт новый.
func applyResource(ctx context.Context, tx pgx.Tx, r seedResource) (int64, error) {
	var id int64
	err := tx.QueryRow(ctx, `SELECT id FROM resources WHERE url = $1 ORDER BY id LIMIT 1`, r.URL).Scan(&id)
	switch err {
	case nil:
		_, err = tx.Exec(ctx, `UPDATE resources SET title = $2, type = $3, language = $4 WHERE id = $1`,
			id, r.Title, r.Type, r.Language)
		return id, err
	case pgx.ErrNoRows:
		err = tx.QueryRow(ctx, `
			INSERT INTO resources (title, url, type, language, is_free, status, review_comment)
			VALUES ($1, $2, $3, $4, true, 'approved', $5)
			RETURNING id`, r.Title, r.URL, r.Type, r.Language, resourceDraftComment).Scan(&id)
		return id, err
	default:
		return 0, err
	}
}

func applyProfession(ctx context.Context, tx pgx.Tx, p seedProfession, skillIDs, topicIDs map[string]int64) error {
	var id int64
	err := tx.QueryRow(ctx, `
		INSERT INTO professions (slug, title, description, for_whom, status, sort_order)
		VALUES ($1, $2, $3, $4, 'available', $5)
		ON CONFLICT (slug) DO UPDATE
		SET title = EXCLUDED.title, description = EXCLUDED.description, for_whom = EXCLUDED.for_whom,
		    status = EXCLUDED.status, sort_order = EXCLUDED.sort_order, updated_at = now()
		RETURNING id`, p.Slug, p.Title, p.Description, p.ForWhom, p.SortOrder).Scan(&id)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM profession_skills WHERE profession_id = $1`, id); err != nil {
		return err
	}
	for _, s := range p.KeySkills {
		if _, err := tx.Exec(ctx, `
			INSERT INTO profession_skills (profession_id, skill_id, is_key) VALUES ($1, $2, true)`,
			id, skillIDs[s]); err != nil {
			return err
		}
	}

	// Блоки пересоздаём: на них ссылаются только block_topics, прогресс привязан к темам.
	if _, err := tx.Exec(ctx, `DELETE FROM blocks WHERE profession_id = $1`, id); err != nil {
		return err
	}
	for i, b := range p.Blocks {
		var blockID int64
		err := tx.QueryRow(ctx, `
			INSERT INTO blocks (profession_id, title, sort_order) VALUES ($1, $2, $3) RETURNING id`,
			id, b.Title, i+1).Scan(&blockID)
		if err != nil {
			return err
		}
		for j, bt := range b.Topics {
			if _, err := tx.Exec(ctx, `
				INSERT INTO block_topics (block_id, topic_id, sort_order, optional_for_junior)
				VALUES ($1, $2, $3, $4)`, blockID, topicIDs[bt.Slug], j+1, bt.Optional); err != nil {
				return err
			}
		}
	}
	return nil
}
