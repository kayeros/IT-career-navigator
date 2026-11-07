// Package httpapi собирает HTTP-роутер api. Модули регистрируют свои маршруты здесь.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Pinger — то, что умеет проверить доступность базы (pgxpool.Pool подходит).
type Pinger interface {
	Ping(ctx context.Context) error
}

// Module — модуль API, который вешает свои маршруты на группу /api/v1.
type Module interface {
	Register(api *gin.RouterGroup)
}

// Options — зависимости роутера.
type Options struct {
	Log *slog.Logger
	DB  Pinger
	// Middleware выполняются для всех запросов /api/v1 (например, определение пользователя по cookie).
	Middleware []gin.HandlerFunc
	Modules    []Module
	// Extra — дополнительные маршруты вне /api/v1 (демо-страница).
	Extra func(r *gin.Engine)
}

// NewRouter возвращает роутер с общими middleware и служебными маршрутами.
func NewRouter(opts Options) *gin.Engine {
	r := gin.New()
	// Не доверяем X-Forwarded-For: IP клиента берём из соединения. Настроить при выкладке за прокси.
	_ = r.SetTrustedProxies(nil)
	r.Use(gin.Recovery(), requestLogger(opts.Log))

	r.GET("/health", healthHandler(opts.DB))

	api := r.Group("/api/v1", opts.Middleware...)
	for _, m := range opts.Modules {
		m.Register(api)
	}
	if opts.Extra != nil {
		opts.Extra(r)
	}
	return r
}

// healthHandler отвечает 200, если сервис жив и база доступна, иначе 503.
func healthHandler(db Pinger) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "fail", "db": "unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "db": "ok"})
	}
}

// requestLogger пишет по строке в журнал на каждый запрос.
func requestLogger(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Info("http",
			"method", c.Request.Method,
			"path", c.FullPath(),
			"status", c.Writer.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
		)
	}
}
