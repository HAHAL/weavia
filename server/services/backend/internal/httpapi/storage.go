package httpapi

import (
	"net/http"

	"github.com/weavia/weavia/services/backend/internal/storageconfig"
)

func (s *Server) adminStorage(w http.ResponseWriter, r *http.Request) {
	cfg, _, err := s.StorageConfig.Load(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, cfg)
}

func (s *Server) adminSaveStorage(w http.ResponseWriter, r *http.Request) {
	var input storageconfig.Input
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	cfg, err := s.StorageConfig.Save(r.Context(), input)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.StorageConfig.Apply(r.Context(), s.Assets); err != nil {
		writeError(w, err)
		return
	}
	ok(w, cfg)
}

func (s *Server) adminTestStorage(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.StorageConfig.Test(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, cfg)
}
