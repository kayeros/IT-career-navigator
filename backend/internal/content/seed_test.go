package content

import (
	"testing"

	"careernav/migrations"
)

// Проверяет настоящие YAML-файлы: Рустам и Алик запускают этот тест после правок.
func TestSeedFilesAreValid(t *testing.T) {
	data, err := LoadSeed(migrations.Seed, "seed")
	if err != nil {
		t.Fatal(err)
	}
	if len(data.Professions) != 3 {
		t.Fatalf("профессий %d, ожидали 3", len(data.Professions))
	}
	// У каждого ключевого навыка должен быть проверочный вопрос, иначе «уверенно» не засчитать.
	withQ := map[string]bool{}
	for _, q := range data.Questions {
		withQ[q.Skill] = true
	}
	for _, p := range data.Professions {
		for _, s := range p.KeySkills {
			if !withQ[s] {
				t.Errorf("%s: у ключевого навыка %q нет проверочного вопроса", p.Slug, s)
			}
		}
	}
}
