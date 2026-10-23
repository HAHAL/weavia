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
		Count     int    `json:"count"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	if input.Count <= 0 {
		input.Count = 1
	}
	if input.Count > 50 {
		input.Count = 50
	}
	items := make([]any, 0, input.Count)
	for i := 0; i < input.Count; i++ {
		item, err := s.Invites.Create(r.Context(), currentUser(r).ID, input.Note, input.MaxUses, input.ValidDays)
		if err != nil {
			writeError(w, err)
			return
		}
		items = append(items, item)
	}
	_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "invite.create", "invite_code", "-", clientIP(r), nil, map[string]any{"count": len(items), "maxUses": input.MaxUses, "validDays": input.ValidDays})
	ok(w, map[string]any{"items": items})
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

func (s *Server) adminRoles(w http.ResponseWriter, r *http.Request) {
	items, err := s.Commercial.ListRoles(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminSetUserRoles(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Codes []string `json:"codes"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	userID := chi.URLParam(r, "userID")
	before, _ := s.Commercial.ListUserRoles(r.Context(), userID)
	if err := s.Commercial.SetUserRoles(r.Context(), currentUser(r).ID, userID, input.Codes); err != nil {
		writeError(w, err)
		return
	}
	_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "user.roles", "user", userID, clientIP(r),
		map[string]any{"roles": before}, map[string]any{"roles": input.Codes})
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) adminUserRoles(w http.ResponseWriter, r *http.Request) {
	codes, err := s.Commercial.ListUserRoles(r.Context(), chi.URLParam(r, "userID"))
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"codes": codes})
}
