package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib" // драйвер database/sql для goose
	"github.com/pressly/goose/v3"

	"careernav/migrations"
)

// Migrate накатывает все новые миграции; уже применённые goose пропускает.
func Migrate(ctx context.Context, url string) error {
	conn, err := sql.Open("pgx", url)
	if err != nil {
		return fmt.Errorf("подключение для миграций: %w", err)
	}
	defer conn.Close()

	goose.SetBaseFS(migrations.SQL)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.UpContext(ctx, conn, "."); err != nil {
		return fmt.Errorf("миграции: %w", err)
	}
	return nil
}
