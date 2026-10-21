package httpapi

import (
	"net/http"
	"time"

	"github.com/weavia/weavia/services/backend/internal/generation"
)

func (s *Server) adminCleanupTasks(w http.ResponseWriter, r *http.Request) {
	if s.Generation == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "生成服务未初始化", Status: 503})
		return
	}
	cleaned, err := s.Generation.CleanupStaleVideo(r.Context(), 30*time.Minute)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"cleaned": cleaned, "creditsReleased": cleaned * 50})
}
