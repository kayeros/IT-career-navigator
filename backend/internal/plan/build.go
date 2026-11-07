// Package plan — план «что учить дальше». Пока строится алгоритмом без ИИ (раздел 8.7 structure.md);
// ИИ-план добавится в worker и будет проверяться по тому же справочнику.
package plan

import (
	"math"
	"sort"
	"time"

	"careernav/internal/match"
)

// Item — тема в плане.
type Item struct {
	TopicID int64
	Slug    string
	Title   string
	Hours   float64
	WeekNo  int
	Status  string // to_learn | optional
	Skills  []string
}

// Built — результат алгоритма.
type Built struct {
	Items              []Item
	TotalHours         float64
	ReadyDate          time.Time
	Late               bool
	HoursPerWeekNeeded *int
	MatchBefore        *float64
	MatchAfter         *float64
}

// Build раскладывает недостающие навыки в упорядоченный список тем со сроками.
//  1. Навыки с уровнем ниже 1: при известных весах — по убыванию веса, иначе по порядку в roadmap.
//  2. Темы навыка — в порядке roadmap; изученные пропускаем, повтор темы не добавляем.
//  3. Часы: с нуля — полностью, если по оценке навык известен «базово» — половина.
//  4. Недели — по часам в неделю, дата готовности сравнивается с дедлайном.
//
// Необязательные для junior темы идут в конце со статусом optional.
func Build(skills []match.KeySkill, hoursPerWeek int, deadline *time.Time, today time.Time) Built {
	need := make([]match.KeySkill, 0, len(skills))
	for _, s := range skills {
		if s.Level() < 1 {
			need = append(need, s)
		}
	}
	firstOrd := func(s match.KeySkill) int {
		if len(s.Topics) == 0 {
			return math.MaxInt32
		}
		return s.Topics[0].Order
	}
	sort.SliceStable(need, func(i, j int) bool {
		if need[i].Weight != need[j].Weight {
			return need[i].Weight > need[j].Weight
		}
		return firstOrd(need[i]) < firstOrd(need[j])
	})

	var items []Item
	index := map[int64]int{} // тема → позиция в items
	for _, s := range need {
		factor := 1.0
		if s.AssessLevel == 0.5 {
			factor = 0.5
		}
		for _, t := range s.Topics {
			if t.Studied {
				continue
			}
			if i, ok := index[t.ID]; ok {
				items[i].Skills = append(items[i].Skills, s.Name)
				continue
			}
			status := "to_learn"
			if t.Optional {
				status = "optional"
			}
			index[t.ID] = len(items)
			items = append(items, Item{TopicID: t.ID, Slug: t.Slug, Title: t.Title, Hours: t.Hours * factor,
				Status: status, Skills: []string{s.Name}})
		}
	}
	// Необязательные для junior темы — в конец, порядок остальных сохраняем.
	sort.SliceStable(items, func(i, j int) bool { return items[i].Status == "to_learn" && items[j].Status == "optional" })

	b := Built{Items: items}
	var cum float64
	for i := range b.Items {
		cum += b.Items[i].Hours
		b.Items[i].WeekNo = max(1, int(math.Ceil(cum/float64(hoursPerWeek))))
	}
	b.TotalHours = math.Round(cum*10) / 10
	weeks := int(math.Ceil(cum / float64(hoursPerWeek)))
	b.ReadyDate = today.AddDate(0, 0, weeks*7)
	if deadline != nil && b.ReadyDate.After(*deadline) {
		b.Late = true
		if left := deadline.Sub(today).Hours() / (24 * 7); left >= 1 {
			n := int(math.Ceil(cum / math.Floor(left)))
			b.HoursPerWeekNeeded = &n
		}
	}

	// % после плана: навыки, у которых все неизученные темы попали в план, станут уровня 1.
	b.MatchBefore = match.Percent(skills)
	after := make([]match.KeySkill, len(skills))
	for i, s := range skills {
		after[i] = s
		if s.Level() < 1 && len(s.Topics) > 0 {
			after[i].AssessLevel = 1
		}
	}
	b.MatchAfter = match.Percent(after)
	return b
}
