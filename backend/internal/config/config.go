// Package config читает настройки сервиса из переменных окружения.
// Секреты (ключи API, пароли) задаются только через окружение или .env, в репозиторий не попадают.
package config

import (
	"errors"
	"fmt"
	"os"
	"time"
)

// Config — настройки, общие для api и worker.
type Config struct {
	// Env — окружение: local, staging, production.
	Env string
	// HTTPAddr — адрес, на котором слушает api.
	HTTPAddr string
	// DatabaseURL — строка подключения к PostgreSQL.
	DatabaseURL string
	// ShutdownTimeout — сколько ждать завершения запросов при остановке.
	ShutdownTimeout time.Duration
	// PublicURL — адрес сайта для ссылок в письмах (подтверждение почты, сброс пароля).
	PublicURL string
}

// Load собирает конфиг из окружения и проверяет обязательные поля.
func Load() (Config, error) {
	cfg := Config{
		Env:         getEnv("APP_ENV", "local"),
		HTTPAddr:    getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		PublicURL:   getEnv("PUBLIC_URL", "http://localhost:3000"),
	}

	timeout, err := time.ParseDuration(getEnv("SHUTDOWN_TIMEOUT", "10s"))
	if err != nil {
		return Config{}, fmt.Errorf("SHUTDOWN_TIMEOUT: %w", err)
	}
	cfg.ShutdownTimeout = timeout

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("не задан DATABASE_URL")
	}
	return cfg, nil
}

// IsLocal сообщает, что сервис запущен на машине разработчика.
func (c Config) IsLocal() bool {
	return c.Env == "local"
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
