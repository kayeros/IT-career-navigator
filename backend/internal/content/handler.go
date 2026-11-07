package content

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"careernav/internal/auth"
	"careernav/internal/httpx"
)

// Handler — HTTP-часть каталога и карточки профессии.
type Handler struct {
	catalog *Catalog
	log     *slog.Logger
}

func NewHandler(catalog *Catalog, log *slog.Logger) *Handler {
	return &Handler{catalog: catalog, log: log}
}

func (h *Handler) Register(api *gin.RouterGroup) {
	api.GET("/professions", h.list)
	api.GET("/professions/:slug", h.get)
	api.POST("/waitlist", h.joinWaitlist)
}

func (h *Handler) list(c *gin.Context) {
	items, err := h.catalog.List(c.Request.Context())
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) get(c *gin.Context) {
	var userID int64
	if u := auth.CurrentUser(c); u != nil {
		userID = u.ID
	}
	p, err := h.catalog.Get(c.Request.Context(), c.Param("slug"), userID)
	if errors.Is(err, ErrNotFound) {
		httpx.NotFound(c)
		return
	}
	if err != nil {
		httpx.Internal(c, h.log, err)
		return
	}
	c.JSON(http.StatusOK, p)
}
