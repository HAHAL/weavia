package httpapi

import (
	"net/http"

	"github.com/weavia/weavia/services/backend/internal/generation"

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

func (s *Server) adminMigrateStorage(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Direction string `json:"direction"`
		DryRun    bool   `json:"dryRun"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	if input.Direction != "to_oss" && input.Direction != "to_local" {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "direction 只支持 to_oss / to_local", Status: 400})
		return
	}
	report, err := s.StorageConfig.Migrate(r.Context(), s.Assets, input.Direction, input.DryRun)
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, report)
}
