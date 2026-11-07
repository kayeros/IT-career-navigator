package auth

import (
	"errors"
	"log/slog"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"careernav/internal/httpx"
)

const (
	cookieName = "session"
	userKey    = "auth.user"
)

// Handler — HTTP-часть модуля аккаунта.
type Handler struct {
	svc          *Service
	log          *slog.Logger
	secureCookie bool
	limiter      *loginLimiter
}

// NewHandler: secureCookie = false только для локальной разработки по http.
func NewHandler(svc *Service, log *slog.Logger, secureCookie bool) *Handler {
	return &Handler{svc: svc, log: log, secureCookie: secureCookie, limiter: newLoginLimiter(5, 15*time.Minute)}
}

// Register вешает маршруты модуля на группу /api/v1.
func (h *Handler) Register(api *gin.RouterGroup) {
	api.POST("/auth/register", h.register)
	api.POST("/auth/login", h.login)
	api.POST("/auth/logout", h.logout)
	api.GET("/me", RequireUser, h.me)
}

// Middleware определяет пользователя по cookie (если есть) и кладёт его в контекст запроса.
func (h *Handler) Middleware(c *gin.Context) {
	token, err := c.Cookie(cookieName)
	if err != nil || token == "" {
		c.Next()
		return
	}
	user, err := h.svc.UserBySession(c.Request.Context(), token)
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	if user != nil {
		c.Set(userKey, user)
	}
	c.Next()
}

// CurrentUser возвращает вошедшего пользователя или nil.
func CurrentUser(c *gin.Context) *User {
	if v, ok := c.Get(userKey); ok {
		return v.(*User)
	}
	return nil
}

// RequireUser отвечает 401, если пользователь не вошёл.
func RequireUser(c *gin.Context) {
	if CurrentUser(c) == nil {
		httpx.Unauthorized(c)
		return
	}
	c.Next()
}

type registerRequest struct {
	Email            string `json:"email"`
	Password         string `json:"password"`
	Name             string `json:"name"`
	ConsentPD        bool   `json:"consent_pd"`
	ConsentMarketing bool   `json:"consent_marketing"`
}

// validate нормализует почту и имя и возвращает ошибки по полям.
func (r *registerRequest) validate() map[string]string {
	errs := map[string]string{}
	r.Email = normalizeEmail(r.Email)
	if !validEmail(r.Email) {
		errs["email"] = "Укажите корректную почту"
	}
	if n := utf8.RuneCountInString(r.Password); n < 8 || n > 128 {
		errs["password"] = "Пароль должен быть от 8 до 128 символов"
	}
	r.Name = strings.TrimSpace(r.Name)
	if n := utf8.RuneCountInString(r.Name); n < 1 || n > 100 {
		errs["name"] = "Укажите имя"
	}
	if !r.ConsentPD {
		errs["consent_pd"] = "Нужно согласие на обработку персональных данных"
	}
	return errs
}

func (h *Handler) register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Validation(c, map[string]string{"body": "Некорректный JSON"})
		return
	}
	if errs := req.validate(); len(errs) > 0 {
		httpx.Validation(c, errs)
		return
	}

	user, token, err := h.svc.Register(c.Request.Context(), RegisterInput{
		Email:            req.Email,
		Password:         req.Password,
		Name:             req.Name,
		ConsentMarketing: req.ConsentMarketing,
		UserAgent:        c.Request.UserAgent(),
	})
	if errors.Is(err, ErrEmailTaken) {
		httpx.Error(c, http.StatusConflict, "email_taken", "Почта уже зарегистрирована")
		return
	}
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	h.setSessionCookie(c, token, int(sessionTTL.Seconds()))
	c.JSON(http.StatusCreated, user)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Validation(c, map[string]string{"body": "Некорректный JSON"})
		return
	}
	req.Email = normalizeEmail(req.Email)
	if req.Email == "" || req.Password == "" {
		httpx.Validation(c, map[string]string{"email": "Укажите почту и пароль"})
		return
	}

	key := c.ClientIP() + "|" + req.Email
	if blocked, retry := h.limiter.Blocked(key); blocked {
		c.Header("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
		httpx.Error(c, http.StatusTooManyRequests, "too_many_attempts", "Слишком много попыток входа, попробуйте позже")
		return
	}

	user, token, err := h.svc.Login(c.Request.Context(), req.Email, req.Password, c.Request.UserAgent())
	if errors.Is(err, ErrInvalidCredentials) {
		h.limiter.Fail(key)
		httpx.Error(c, http.StatusUnauthorized, "invalid_credentials", "Неверная почта или пароль")
		return
	}
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	h.limiter.Reset(key)
	h.setSessionCookie(c, token, int(sessionTTL.Seconds()))
	c.JSON(http.StatusOK, user)
}

func (h *Handler) logout(c *gin.Context) {
	if token, err := c.Cookie(cookieName); err == nil && token != "" {
		if err := h.svc.Logout(c.Request.Context(), token); err != nil {
			httpx.Internal(c, h.log, err)
			return
		}
	}
	h.setSessionCookie(c, "", -1)
	c.Status(http.StatusNoContent)
}

func (h *Handler) me(c *gin.Context) {
	c.JSON(http.StatusOK, CurrentUser(c))
}

func (h *Handler) setSessionCookie(c *gin.Context, token string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func validEmail(s string) bool {
	if len(s) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Address == s && strings.Contains(s[strings.LastIndex(s, "@"):], ".")
}
