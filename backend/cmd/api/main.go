// Команда api — HTTP-сервер платформы (модульный монолит).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"careernav/internal/admin"
	"careernav/internal/assessment"
	"careernav/internal/auth"
	"careernav/internal/config"
	"careernav/internal/content"
	"careernav/internal/db"
	"careernav/internal/demo"
	"careernav/internal/httpapi"
	"careernav/internal/logger"
	"careernav/internal/mail"
	"careernav/internal/match"
	"careernav/internal/plan"
	"careernav/internal/profile"
	"careernav/internal/progress"
	"careernav/migrations"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api остановлен с ошибкой", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logger.New(cfg.IsLocal())
	if !cfg.IsLocal() {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.Migrate(ctx, cfg.DatabaseURL); err != nil {
		return err
	}
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "migrate":
			log.Info("миграции применены")
			return nil
		case "seed":
			data, err := content.LoadSeed(migrations.Seed, "seed")
			if err != nil {
				return err
			}
			if err := content.ApplySeed(ctx, pool, data); err != nil {
				return err
			}
			log.Info("seed применён", "professions", len(data.Professions), "topics", len(data.Topics), "skills", len(data.Skills))
			return nil
		case "create-admin":
			if len(os.Args) < 3 {
				return errors.New("укажите почту: api create-admin <почта>")
			}
			return createAdmin(ctx, pool, log, os.Args[2])
		default:
			return fmt.Errorf("неизвестная команда %q", os.Args[1])
		}
	}

	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: newRouter(cfg, log, pool),
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("api запущен", "addr", cfg.HTTPAddr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	log.Info("api останавливается")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

// newRouter собирает модули API.
func newRouter(cfg config.Config, log *slog.Logger, pool *pgxpool.Pool) http.Handler {
	mailer := mail.LogMailer{Log: log}
	authHandler := auth.NewHandler(auth.NewService(pool, log, mailer, cfg.PublicURL), log, !cfg.IsLocal())
	contentHandler := content.NewHandler(content.NewCatalog(pool), log)
	progressHandler := progress.NewHandler(pool, log)
	adminHandler := admin.NewHandler(pool, log)
	profileHandler := profile.NewHandler(pool, log)
	assessmentHandler := assessment.NewHandler(pool, log)
	planHandler := plan.NewHandler(pool, log)
	matchHandler := match.NewHandler(pool, log)

	opts := httpapi.Options{
		Log:        log,
		DB:         pool,
		Middleware: []gin.HandlerFunc{authHandler.Middleware},
		Modules: []httpapi.Module{authHandler, contentHandler, progressHandler, matchHandler, adminHandler,
			profileHandler, assessmentHandler, planHandler},
	}
	// Временная демо-страница — только на машине разработчика.
	if cfg.IsLocal() {
		opts.Extra = demo.Mount
	}
	return httpapi.NewRouter(opts)
}

// createAdmin выдаёт роль admin уже зарегистрированному пользователю.
// Пароль через командную строку не передаём: человек сначала регистрируется сам.
func createAdmin(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	tag, err := pool.Exec(ctx, `UPDATE users SET role = 'admin' WHERE email = $1`, email)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("пользователь %s не найден: сначала зарегистрируйтесь на сайте", email)
	}
	log.Info("роль admin выдана", "email", email)
	return nil
}
