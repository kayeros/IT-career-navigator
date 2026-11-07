// Package match — процент соответствия вакансиям: Σ(вес × уровень) / Σ весов ключевых навыков.
package match

import (
	"math"
	"sort"
	"time"
)

// MinVacancies — меньше вакансий в снимке → данные предварительные (флаг preliminary).
const MinVacancies = 200

// TopMissing — сколько недостающих навыков показываем.
const TopMissing = 5

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
}

// KeySkill — ключевой навык профессии с весом из снимка и темами профессии, которые его закрывают.
type KeySkill struct {
	ID     int64
	Name   string
	Weight float64
	Topics []TopicLink
}

// Level — уровень навыка на срезе 0 из «Изучено»: все темы изучены → 1, часть → 0,5, ни одной → 0.
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

// Compute считает процент и топ недостающих навыков. Навыки с нулевым весом не участвуют.
func Compute(skills []KeySkill) Result {
	res := Result{Missing: []MissingSkill{}}
	var sumWeights, sumScore float64
	for _, s := range skills {
		if s.Weight <= 0 {
			continue
		}
		level := Level(s.Topics)
		res.KeySkillsTotal++
		sumWeights += s.Weight
		sumScore += s.Weight * level
		if level == 1 {
			res.KeySkillsCovered++
			continue
		}
		topics := s.Topics
		if topics == nil {
			topics = []TopicLink{}
		}
		res.Missing = append(res.Missing, MissingSkill{SkillID: s.ID, Name: s.Name, Weight: s.Weight, Level: level, Topics: topics})
	}

	percent := 0.0
	if sumWeights > 0 {
		percent = math.Round(sumScore/sumWeights*1000) / 10
	}
	res.Percent = &percent

	sort.SliceStable(res.Missing, func(i, j int) bool {
		if res.Missing[i].Weight != res.Missing[j].Weight {
			return res.Missing[i].Weight > res.Missing[j].Weight
		}
		return res.Missing[i].Name < res.Missing[j].Name
	})
	if len(res.Missing) > TopMissing {
		res.Missing = res.Missing[:TopMissing]
	}
	return res
}
