// Команда worker — фоновые задачи: запросы к языковой модели, письма (вакансии собирает collector/).
// Пока только подключается к базе и ждёт сигнала остановки; задачи добавляются по этапам.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"careernav/internal/config"
	"careernav/internal/db"
	"careernav/internal/logger"
)

func main() {
	if err := run(); err != nil {
		slog.Error("worker остановлен с ошибкой", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logger.New(cfg.IsLocal())

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	log.Info("worker запущен", "env", cfg.Env)
	<-ctx.Done()
	log.Info("worker останавливается")
	return nil
}
