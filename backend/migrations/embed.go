// Package migrations встраивает SQL-миграции goose и seed-контент в бинарник api.
package migrations

import "embed"

// SQL — файлы миграций goose.
//
//go:embed *.sql
var SQL embed.FS

// Seed — черновик контента профессий (YAML), его правит команда.
//
//go:embed all:seed
var Seed embed.FS
