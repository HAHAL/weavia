package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

func (s *Server) adminRouteGroups(w http.ResponseWriter, r *http.Request) {
	items, err := s.Routing.ListRouteGroups(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminCreateRouteGroup(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Code        string `json:"code"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	if input.Code == "" || input.Name == "" {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "分组代码和名称必填", Status: 400})
		return
	}
	group, err := s.Routing.CreateRouteGroup(r.Context(), input.Code, input.Name, input.Description)
	respond(w, group, err)
}

func (s *Server) adminSetGroupChannels(w http.ResponseWriter, r *http.Request) {
	var input struct {
		ChannelIDs []string `json:"channelIds"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Routing.SetGroupChannels(r.Context(), chi.URLParam(r, "groupID"), input.ChannelIDs))
}

func (s *Server) adminAccountGroups(w http.ResponseWriter, r *http.Request) {
	userID, err := s.Commercial.UserIDByAccount(r.Context(), chi.URLParam(r, "accountNo"))
	if err != nil {
		writeError(w, err)
		return
	}
	codes, err := s.Routing.ListAccountGroups(r.Context(), userID)
	respond(w, map[string]any{"codes": codes}, err)
}

func (s *Server) adminSetAccountGroups(w http.ResponseWriter, r *http.Request) {
	userID, err := s.Commercial.UserIDByAccount(r.Context(), chi.URLParam(r, "accountNo"))
	if err != nil {
		writeError(w, err)
		return
	}
	var input struct {
		Codes []string `json:"codes"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Routing.SetAccountGroups(r.Context(), userID, input.Codes))
}
