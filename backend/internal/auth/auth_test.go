package auth

import (
	"testing"
	"time"
)

func TestPasswordHash(t *testing.T) {
	hash, err := HashPassword("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if ok, _ := VerifyPassword("correct horse", hash); !ok {
		t.Fatal("верный пароль не прошёл проверку")
	}
	if ok, _ := VerifyPassword("wrong", hash); ok {
		t.Fatal("неверный пароль прошёл проверку")
	}
	other, _ := HashPassword("correct horse")
	if other == hash {
		t.Fatal("у одинаковых паролей одинаковый хеш — соль не работает")
	}
}

func TestLoginLimiter(t *testing.T) {
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	l := newLoginLimiter(3, 15*time.Minute)
	l.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		if blocked, _ := l.Blocked("k"); blocked {
			t.Fatalf("заблокировано после %d попыток", i)
		}
		l.Fail("k")
	}
	if blocked, _ := l.Blocked("k"); !blocked {
		t.Fatal("не заблокировано после 3 неудач")
	}
	if blocked, _ := l.Blocked("other"); blocked {
		t.Fatal("заблокирован чужой ключ")
	}

	now = now.Add(16 * time.Minute)
	if blocked, _ := l.Blocked("k"); blocked {
		t.Fatal("блокировка не снялась после окна")
	}
}

func TestRegisterValidation(t *testing.T) {
	ok := registerRequest{Email: "  Ivan@Example.RU ", Password: "12345678", Name: " Иван ", ConsentPD: true}
	if errs := ok.validate(); len(errs) != 0 {
		t.Fatalf("ошибки на верных данных: %v", errs)
	}
	if ok.Email != "ivan@example.ru" || ok.Name != "Иван" {
		t.Fatalf("не нормализовано: %q %q", ok.Email, ok.Name)
	}

	bad := registerRequest{Email: "ivan@", Password: "short", Name: "", ConsentPD: false}
	errs := bad.validate()
	for _, f := range []string{"email", "password", "name", "consent_pd"} {
		if _, ok := errs[f]; !ok {
			t.Errorf("нет ошибки для поля %s", f)
		}
	}
}
