// Package demo — временная демо-страница для показа API без фронтенда.
// Работает только при APP_ENV=local. После готовности SPA (frontend/) пакет удаляем.
package demo

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"
)

//go:embed static
var static embed.FS

// Mount отдаёт демо-страницу по /demo/.
func Mount(r *gin.Engine) {
	sub, _ := fs.Sub(static, "static")
	r.StaticFS("/demo", http.FS(sub))
	r.GET("/", func(c *gin.Context) { c.Redirect(http.StatusFound, "/demo/") })
}
