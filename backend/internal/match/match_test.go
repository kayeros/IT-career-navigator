package match

import "testing"

func topics(studied ...bool) []TopicLink {
	res := make([]TopicLink, len(studied))
	for i, s := range studied {
		res[i] = TopicLink{ID: int64(i + 1), Studied: s}
	}
	return res
}

func TestLevel(t *testing.T) {
	cases := []struct {
		name   string
		topics []TopicLink
		want   float64
	}{
		{"нет тем", nil, 0},
		{"ничего не изучено", topics(false, false), 0},
		{"часть изучена", topics(true, false), 0.5},
		{"всё изучено", topics(true, true), 1},
	}
	for _, tc := range cases {
		if got := Level(tc.topics); got != tc.want {
			t.Errorf("%s: уровень %v, ожидали %v", tc.name, got, tc.want)
		}
	}
}

func TestCompute(t *testing.T) {
	res := Compute([]KeySkill{
		{ID: 1, Name: "SQL", Weight: 0.6, Topics: topics(true)},         // 1
		{ID: 2, Name: "Jira", Weight: 0.3, Topics: topics(true, false)}, // 0,5
		{ID: 3, Name: "Git", Weight: 0.1, Topics: topics(false)},        // 0
		{ID: 4, Name: "ADB", Weight: 0, Topics: topics(false)},          // не участвует
	})
	// (0,6×1 + 0,3×0,5 + 0,1×0) / 1,0 = 75%
	if res.Percent == nil || *res.Percent != 75 {
		t.Fatalf("процент %v, ожидали 75", res.Percent)
	}
	if res.KeySkillsTotal != 3 || res.KeySkillsCovered != 1 {
		t.Fatalf("навыков %d/%d, ожидали 1/3", res.KeySkillsCovered, res.KeySkillsTotal)
	}
	if len(res.Missing) != 2 || res.Missing[0].Name != "Jira" || res.Missing[1].Name != "Git" {
		t.Fatalf("недостающие навыки не по убыванию веса: %+v", res.Missing)
	}
}

func TestComputeTopFive(t *testing.T) {
	var skills []KeySkill
	for i := 1; i <= 8; i++ {
		skills = append(skills, KeySkill{ID: int64(i), Name: string(rune('A' + i)), Weight: float64(i) / 10})
	}
	res := Compute(skills)
	if len(res.Missing) != TopMissing || res.Missing[0].Weight != 0.8 {
		t.Fatalf("ожидали топ-5 с самого тяжёлого навыка, получили %+v", res.Missing)
	}
	if *res.Percent != 0 {
		t.Fatalf("ничего не изучено, а процент %v", *res.Percent)
	}
}

func TestAssessmentLevelWins(t *testing.T) {
	// «Изучено» даёт 0,5 (одна тема из двух), оценка — 1: берём максимум.
	s := KeySkill{Weight: 0.5, AssessLevel: 1, Topics: topics(true, false)}
	if s.Level() != 1 {
		t.Fatalf("уровень %v, ожидали 1", s.Level())
	}
	s.AssessLevel = 0
	if s.Level() != 0.5 {
		t.Fatalf("уровень %v, ожидали 0,5", s.Level())
	}
}

func TestBuildReport(t *testing.T) {
	c := &Calc{Snapshot: &Snapshot{VacancyCount: 300}, Skills: []KeySkill{
		{ID: 1, Name: "SQL", Weight: 0.6, AssessLevel: 1},
		{ID: 2, Name: "Jira", Weight: 0.3, AssessLevel: 0.5},
		{ID: 3, Name: "Git", Weight: 0.2},
		{ID: 4, Name: "ADB", Weight: 0.1},
		{ID: 5, Name: "XML", Weight: 0.05},
	}}
	r := BuildReport(c)
	if r.Counts != (Counts{Have: 1, Partial: 1, Missing: 3}) {
		t.Fatalf("группы %+v", r.Counts)
	}
	if len(r.TopGaps) != TopGaps || r.TopGaps[0].Name != "Jira" || r.TopGaps[2].Name != "ADB" {
		t.Fatalf("топ-3 пробела не по весу: %+v", r.TopGaps)
	}
	// (0,6 + 0,15) / 1,25 = 60%
	if r.Percent == nil || *r.Percent != 60 {
		t.Fatalf("процент %v", r.Percent)
	}
	if BuildReport(&Calc{Skills: c.Skills}).Percent != nil {
		t.Fatal("без снимка весов процент должен быть null")
	}
}
