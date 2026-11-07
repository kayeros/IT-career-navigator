// Package httpx — общие помощники HTTP-обработчиков: единый формат ошибок API.
package httpx

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorBody — формат ошибки из api/openapi.yaml: {"error": {"code", "message", "fields"}}.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

// Error отвечает ошибкой и прерывает обработку запроса.
func Error(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, ErrorBody{Error: ErrorDetail{Code: code, Message: message}})
}

// Validation отвечает 400 с ошибками по полям формы.
func Validation(c *gin.Context, fields map[string]string) {
	c.AbortWithStatusJSON(http.StatusBadRequest, ErrorBody{Error: ErrorDetail{
		Code:    "validation_error",
		Message: "Проверьте поля формы",
		Fields:  fields,
	}})
}

// Unauthorized — пользователь не вошёл.
func Unauthorized(c *gin.Context) {
	Error(c, http.StatusUnauthorized, "unauthorized", "Войдите, чтобы продолжить")
}

// NotFound — объекта нет.
func NotFound(c *gin.Context) {
	Error(c, http.StatusNotFound, "not_found", "Не найдено")
}

// Internal пишет ошибку в журнал и отвечает 500 без подробностей.
func Internal(c *gin.Context, log *slog.Logger, err error) {
	log.Error("ошибка обработки запроса", "path", c.FullPath(), "err", err)
	Error(c, http.StatusInternalServerError, "internal", "Что-то пошло не так, попробуйте позже")
}
