// Package logger настраивает общий журнал (slog).
package logger

import (
	"log/slog"
	"os"
)

// New возвращает текстовый журнал для локальной разработки и JSON — для серверов.
func New(local bool) *slog.Logger {
	if local {
		return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, nil))
}
