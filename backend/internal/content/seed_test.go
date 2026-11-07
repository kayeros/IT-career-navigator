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
}
