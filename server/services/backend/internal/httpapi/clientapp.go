package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/clientapp"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

func (s *Server) clientAppReady(w http.ResponseWriter) bool {
	if s.ClientApp == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "客户端配置服务未初始化", Status: 503})
		return false
	}
	return true
}

// clientConfig is public: clients read it before login to learn the API
// address and whether their version is still allowed.
func (s *Server) clientConfig(w http.ResponseWriter, r *http.Request) {
	if !s.clientAppReady(w) {
		return
	}
	cfg, err := s.ClientApp.Config(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	ok(w, cfg)
}

func (s *Server) adminSaveClientConfig(w http.ResponseWriter, r *http.Request) {
	if !s.clientAppReady(w) {
		return
	}
	var body clientapp.Config
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	cfg, err := s.ClientApp.SaveConfig(r.Context(), body)
	respond(w, cfg, err)
}

func (s *Server) listAnnouncements(w http.ResponseWriter, r *http.Request) {
	if !s.clientAppReady(w) {
		return
	}
	items, err := s.ClientApp.ActiveAnnouncements(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminListAnnouncements(w http.ResponseWriter, r *http.Request) {
	if !s.clientAppReady(w) {
		return
	}
	items, err := s.ClientApp.AllAnnouncements(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminCreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	if !s.clientAppReady(w) {
		return
	}
	var body clientapp.AnnouncementInput
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	item, err := s.ClientApp.CreateAnnouncement(r.Context(), currentUser(r).ID, body)
	respond(w, item, err)
}

func (s *Server) adminUpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	if !s.clientAppReady(w) {
		return
	}
	var body clientapp.AnnouncementInput
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	item, err := s.ClientApp.UpdateAnnouncement(r.Context(), chi.URLParam(r, "announcementID"), body)
	respond(w, item, err)
}

func (s *Server) adminDeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	if !s.clientAppReady(w) {
		return
	}
	if err := s.ClientApp.DeleteAnnouncement(r.Context(), chi.URLParam(r, "announcementID")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
