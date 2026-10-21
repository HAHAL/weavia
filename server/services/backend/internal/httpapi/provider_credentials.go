package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

func (s *Server) adminSetProviderCredential(w http.ResponseWriter, r *http.Request) {
	if s.Credentials == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "凭据服务未初始化", Status: 503})
		return
	}
	var body struct {
		APIKey string `json:"apiKey"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if err := s.Credentials.Set(r.Context(), chi.URLParam(r, "providerCode"), body.APIKey, currentUser(r).ID); err != nil {
		writeError(w, err)
		return
	}
	data, err := s.snapshot(r.Context())
	respond(w, data, err)
}
