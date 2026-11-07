package assessment

import "testing"

func TestLevel(t *testing.T) {
	yes, no := true, false
	cases := []struct {
		self   string
		passed *bool
		want   float64
	}{
		{"none", nil, 0},
		{"basic", nil, 0.5},
		{"confident", &yes, 1},
		{"confident", &no, 0.5},
		{"confident", nil, 0.5}, // проверочного вопроса нет — «уверенно» не подтверждено
	}
	for _, tc := range cases {
		if got := Level(tc.self, tc.passed); got != tc.want {
			t.Errorf("%s/%v: уровень %v, ожидали %v", tc.self, tc.passed, got, tc.want)
		}
	}
}
