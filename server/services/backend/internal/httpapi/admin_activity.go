package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

func (s *Server) adminUserActivity(w http.ResponseWriter, r *http.Request) {
	days := 15
	if raw := r.URL.Query().Get("days"); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 && value <= 90 {
			days = value
		}
	}
	data, err := s.Commercial.AdminUserActivity(r.Context(), chi.URLParam(r, "userID"), days)
	respond(w, data, err)
}
