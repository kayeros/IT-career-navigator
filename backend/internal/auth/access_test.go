package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRequireRoles(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name string
		user *User
		want int
	}{
		{"гость", nil, http.StatusUnauthorized},
		{"пользователь", &User{ID: 1, Role: "user"}, http.StatusForbidden},
		{"админ", &User{ID: 2, Role: "admin"}, http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/x", func(c *gin.Context) {
				if tc.user != nil {
					c.Set(userKey, tc.user)
				}
				c.Next()
			}, RequireUser, RequireAdmin, func(c *gin.Context) { c.Status(http.StatusOK) })
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
			if w.Code != tc.want {
				t.Fatalf("код %d, ожидали %d", w.Code, tc.want)
			}
		})
	}
}

func TestTokensAndLinks(t *testing.T) {
	if tokenTTL(tokenPasswordReset) != time.Hour || tokenTTL(tokenEmailVerify) != 48*time.Hour {
		t.Fatal("ссылка на сброс пароля живёт 1 час, подтверждение почты — 48 часов")
	}
	a, _ := newToken()
	b, _ := newToken()
	if a == b || len(a) < 40 {
		t.Fatal("токены должны быть случайными и длинными")
	}
	if hashToken(a) == a || len(hashToken(a)) != 64 {
		t.Fatal("в БД хранится sha256-хеш, а не сам токен")
	}
	s := &Service{publicURL: "https://navigator.example"}
	link := s.link("/reset-password", "a+b/c")
	if !strings.HasPrefix(link, "https://navigator.example/reset-password?token=") || strings.Contains(link, "a+b/c") {
		t.Fatalf("токен в ссылке должен экранироваться: %s", link)
	}
}

func TestValidEmail(t *testing.T) {
	for _, e := range []string{"ivan@example.ru", "a.b+tag@mail.example.com"} {
		if !validEmail(e) {
			t.Errorf("%s — корректная почта", e)
		}
	}
	for _, e := range []string{"", "ivan@", "ivan@localhost", "Иван <ivan@example.ru>", strings.Repeat("a", 250) + "@x.ru"} {
		if validEmail(e) {
			t.Errorf("%q — некорректная почта", e)
		}
	}
}
