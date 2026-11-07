// Package match — процент соответствия вакансиям и краткий отчёт о разрыве:
// Σ(вес × уровень) / Σ весов ключевых навыков. Отчёт не хранится, считается на лету.
package match

import (
	"math"
	"sort"
	"time"
)

// MinVacancies — меньше вакансий в снимке → данные предварительные (флаг preliminary).
const MinVacancies = 200

// TopMissing — сколько недостающих навыков показываем в блоке соответствия.
const TopMissing = 5

// TopGaps — сколько пробелов в кратком отчёте.
const TopGaps = 3

type Result struct {
	Percent          *float64       `json:"percent"`
	Snapshot         *Snapshot      `json:"snapshot"`
	KeySkillsTotal   int            `json:"key_skills_total"`
	KeySkillsCovered int            `json:"key_skills_covered"`
	Missing          []MissingSkill `json:"missing"`
}

type Snapshot struct {
	Period       string    `json:"period"`
	VacancyCount int       `json:"vacancy_count"`
	CalculatedAt time.Time `json:"calculated_at"`
	Preliminary  bool      `json:"preliminary"`
}

type MissingSkill struct {
	SkillID int64       `json:"skill_id"`
	Name    string      `json:"name"`
	Weight  float64     `json:"weight"`
	Level   float64     `json:"level"`
	Topics  []TopicLink `json:"topics"`
}

type TopicLink struct {
	ID      int64  `json:"id"`
	Slug    string `json:"slug"`
	Title   string `json:"title"`
	Studied bool   `json:"studied"`
	// Для плана; в ответы API не попадают.
	Hours    float64 `json:"-"`
	Order    int     `json:"-"`
	Optional bool    `json:"-"`
}

// KeySkill — ключевой навык профессии с весом из снимка, уровнем из оценки и темами профессии, которые его закрывают.
type KeySkill struct {
	ID          int64
	Name        string
	Weight      float64
	AssessLevel float64
	Topics      []TopicLink
}

// Level — итоговый уровень навыка: максимум из оценки навыков и «Изучено».
func (s KeySkill) Level() float64 {
	return math.Max(s.AssessLevel, Level(s.Topics))
}

// Level — уровень навыка из «Изучено»: все темы изучены → 1, часть → 0,5, ни одной → 0.
func Level(topics []TopicLink) float64 {
	studied := 0
	for _, t := range topics {
		if t.Studied {
			studied++
		}
	}
	switch {
	case len(topics) == 0 || studied == 0:
		return 0
	case studied == len(topics):
		return 1
	default:
		return 0.5
	}
}

// Percent — процент соответствия по навыкам с весом. nil — весов нет.
func Percent(skills []KeySkill) *float64 {
	var sumWeights, sumScore float64
	for _, s := range skills {
		if s.Weight > 0 {
			sumWeights += s.Weight
			sumScore += s.Weight * s.Level()
		}
	}
	if sumWeights == 0 {
		return nil
	}
	p := math.Round(sumScore/sumWeights*1000) / 10
	return &p
}

// gaps — навыки с уровнем ниже 1 по убыванию веса.
func gaps(skills []KeySkill, onlyWeighted bool) []MissingSkill {
	out := []MissingSkill{}
	for _, s := range skills {
		if onlyWeighted && s.Weight <= 0 {
			continue
		}
		if level := s.Level(); level < 1 {
			topics := s.Topics
			if topics == nil {
				topics = []TopicLink{}
			}
			out = append(out, MissingSkill{SkillID: s.ID, Name: s.Name, Weight: s.Weight, Level: level, Topics: topics})
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Weight != out[j].Weight {
			return out[i].Weight > out[j].Weight
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// Compute считает процент и топ недостающих навыков. Навыки с нулевым весом не участвуют.
func Compute(skills []KeySkill) Result {
	res := Result{Missing: []MissingSkill{}}
	for _, s := range skills {
		if s.Weight <= 0 {
			continue
		}
		res.KeySkillsTotal++
		if s.Level() == 1 {
			res.KeySkillsCovered++
		}
	}
	if p := Percent(skills); p != nil {
		res.Percent = p
	} else if res.KeySkillsTotal > 0 {
		zero := 0.0
		res.Percent = &zero
	}
	res.Missing = gaps(skills, true)
	if len(res.Missing) > TopMissing {
		res.Missing = res.Missing[:TopMissing]
	}
	return res
}

// Counts — сколько ключевых навыков есть, частично и не хватает.
type Counts struct {
	Have    int `json:"have"`
	Partial int `json:"partial"`
	Missing int `json:"missing"`
}

type AssessmentRef struct {
	ID          int64     `json:"id"`
	CompletedAt time.Time `json:"completed_at"`
}

// Report — краткий отчёт о разрыве.
type Report struct {
	Percent    *float64       `json:"percent"`
	Snapshot   *Snapshot      `json:"snapshot"`
	Assessment *AssessmentRef `json:"assessment"`
	Counts     Counts         `json:"counts"`
	TopGaps    []MissingSkill `json:"top_gaps"`
}

// BuildReport — краткий отчёт: процент, группы навыков и три главных пробела.
// Без снимка весов пробелы идут по названию (веса неизвестны).
func BuildReport(c *Calc) Report {
	r := Report{Snapshot: c.Snapshot}
	if c.Snapshot != nil {
		r.Percent = Percent(c.Skills)
		if r.Percent == nil {
			zero := 0.0
			r.Percent = &zero
		}
	}
	for _, s := range c.Skills {
		switch l := s.Level(); {
		case l == 1:
			r.Counts.Have++
		case l > 0:
			r.Counts.Partial++
		default:
			r.Counts.Missing++
		}
	}
	r.TopGaps = gaps(c.Skills, false)
	if len(r.TopGaps) > TopGaps {
		r.TopGaps = r.TopGaps[:TopGaps]
	}
	return r
}
