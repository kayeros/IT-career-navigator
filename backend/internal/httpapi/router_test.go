package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func TestHealth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	cases := []struct {
		name string
		db   fakeDB
		want int
	}{
		{"база доступна", fakeDB{}, http.StatusOK},
		{"база недоступна", fakeDB{err: errors.New("down")}, http.StatusServiceUnavailable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := NewRouter(Options{Log: log, DB: tc.db})
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))
			if w.Code != tc.want {
				t.Fatalf("код ответа %d, ожидали %d", w.Code, tc.want)
			}
		})
	}
}
