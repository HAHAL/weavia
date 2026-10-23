package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (s *Server) adminInvites(w http.ResponseWriter, r *http.Request) {
	items, err := s.Invites.List(r.Context())
	if err != nil {
		respond(w, nil, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminCreateInvite(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Note      string `json:"note"`
		MaxUses   int    `json:"maxUses"`
		ValidDays int    `json:"validDays"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	item, err := s.Invites.Create(r.Context(), currentUser(r).ID, input.Note, input.MaxUses, input.ValidDays)
	respond(w, item, err)
}

func (s *Server) adminUpdateInvite(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Enabled bool `json:"enabled"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Invites.SetEnabled(r.Context(), chi.URLParam(r, "inviteID"), input.Enabled))
}
