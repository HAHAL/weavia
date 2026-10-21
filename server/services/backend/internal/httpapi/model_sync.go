package httpapi

import (
	"net/http"

	"github.com/weavia/weavia/services/backend/internal/generation"
)

func (s *Server) adminSyncModels(w http.ResponseWriter, r *http.Request) {
	if s.Models == nil || s.Routing == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "模型服务未初始化", Status: 503})
		return
	}
	items, err := s.Models.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	if err = s.Routing.SyncCatalog(r.Context(), items); err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"synced": len(items)})
}
