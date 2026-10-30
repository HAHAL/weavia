package httpapi

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

func (s *Server) cancelTask(w http.ResponseWriter, r *http.Request) {
	task, err := s.Generation.Cancel(r.Context(), currentUser(r).ID, chi.URLParam(r, "taskID"))
	respond(w, task, err)
}

func (s *Server) adminResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	resetter, ok := s.Auth.(interface {
		AdminResetPassword(ctx context.Context, userID, password string) error
	})
	if !ok {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "认证服务不支持重置密码", Status: 503})
		return
	}
	err := resetter.AdminResetPassword(r.Context(), chi.URLParam(r, "userID"), body.Password)
	respond(w, map[string]bool{"reset": err == nil}, err)
}
