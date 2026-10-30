package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/routing"
)

func (s *Server) adminAIHealth(w http.ResponseWriter, r *http.Request) {
	health, err := s.Routing.Health(r.Context())
	respond(w, health, err)
}

func (s *Server) adminAILogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	hours, _ := strconv.Atoi(q.Get("hours"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	result, err := s.Routing.Logs(r.Context(), routing.LogFilter{Model: q.Get("model"), Channel: q.Get("channel"), Status: q.Get("status"), Code: q.Get("code"), Hours: hours, Limit: limit})
	respond(w, result, err)
}

func (s *Server) adminTestChannelKey(w http.ResponseWriter, r *http.Request) {
	result, err := s.Routing.TestKey(r.Context(), chi.URLParam(r, "keyID"))
	respond(w, result, err)
}

func (s *Server) adminUpdateLogicalModel(w http.ResponseWriter, r *http.Request) {
	var body routing.LogicalPatch
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	key := chi.URLParam(r, "modelKey")
	err := s.Routing.UpdateLogical(r.Context(), key, body)
	if err == nil && s.Commercial != nil {
		_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "model.update", "logical_model", key, clientIP(r), nil, body)
	}
	respond(w, map[string]bool{"ok": err == nil}, err)
}
