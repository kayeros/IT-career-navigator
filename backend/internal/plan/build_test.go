package plan

import (
	"testing"
	"time"

	"careernav/internal/match"
)

func tl(id int64, ord int, hours float64, studied, optional bool) match.TopicLink {
	return match.TopicLink{ID: id, Slug: "t", Title: "t", Order: ord, Hours: hours, Studied: studied, Optional: optional}
}

func TestBuildOrderAndHours(t *testing.T) {
	today := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)
	skills := []match.KeySkill{
		{ID: 1, Name: "Git", Weight: 0.3, Topics: []match.TopicLink{tl(10, 1, 12, false, false)}},
		{ID: 2, Name: "SQL", Weight: 0.6, AssessLevel: 0.5, Topics: []match.TopicLink{tl(20, 5, 20, false, false)}},
		{ID: 3, Name: "Linux", Weight: 0.9, AssessLevel: 1, Topics: []match.TopicLink{tl(30, 2, 15, false, false)}}, // уже знает
		{ID: 4, Name: "HTTP", Weight: 0.5, Topics: []match.TopicLink{tl(40, 3, 8, true, false), tl(41, 4, 6, false, false)}},
		{ID: 5, Name: "Kafka", Weight: 0.4, Topics: []match.TopicLink{tl(50, 9, 8, false, true)}},
		{ID: 6, Name: "REST", Weight: 0.2, Topics: []match.TopicLink{tl(41, 4, 6, false, false)}}, // тема уже в плане
	}
	b := Build(skills, 10, nil, today)

	var got []int64
	for _, it := range b.Items {
		got = append(got, it.TopicID)
	}
	// SQL (0,6) → HTTP (0,5, без изученной темы 40) → Git (0,3); Kafka необязательная — в конце.
	want := []int64{20, 41, 10, 50}
	if len(got) != len(want) {
		t.Fatalf("темы %v, ожидали %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("темы %v, ожидали %v", got, want)
		}
	}
	if b.Items[0].Hours != 10 {
		t.Errorf("SQL «базово»: часов %v, ожидали половину — 10", b.Items[0].Hours)
	}
	if len(b.Items[1].Skills) != 2 {
		t.Errorf("тема 41 закрывает HTTP и REST, получили %v", b.Items[1].Skills)
	}
	if b.Items[3].Status != "optional" {
		t.Errorf("Kafka должна быть optional")
	}
	// 10 + 6 + 12 + 8 = 36 ч при 10 ч/нед → 4 недели.
	if b.TotalHours != 36 || !b.ReadyDate.Equal(today.AddDate(0, 0, 28)) {
		t.Errorf("часов %v, готовность %v", b.TotalHours, b.ReadyDate)
	}
	if b.Items[0].WeekNo != 1 || b.Items[2].WeekNo != 3 {
		t.Errorf("недели: %d, %d", b.Items[0].WeekNo, b.Items[2].WeekNo)
	}
	if b.MatchAfter == nil || *b.MatchAfter != 100 {
		t.Errorf("после плана все навыки закрыты, а процент %v", b.MatchAfter)
	}
}

func TestBuildDeadline(t *testing.T) {
	today := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)
	skills := []match.KeySkill{{ID: 1, Name: "Java", Weight: 1, Topics: []match.TopicLink{tl(1, 1, 100, false, false)}}}
	deadline := today.AddDate(0, 0, 28) // 4 недели
	b := Build(skills, 10, &deadline, today)
	if !b.Late || b.HoursPerWeekNeeded == nil || *b.HoursPerWeekNeeded != 25 {
		t.Fatalf("100 ч за 4 недели — нужно 25 ч/нед; получили late=%v needed=%v", b.Late, b.HoursPerWeekNeeded)
	}
	if b := Build(skills, 30, &deadline, today); b.Late {
		t.Fatal("при 30 ч/нед успевает")
	}
}
