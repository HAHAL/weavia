package httpapi

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

func (s *Server) adminChannels(w http.ResponseWriter, r *http.Request) {
	if s.Routing == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "路由服务未初始化", Status: 503})
		return
	}
	items, err := s.Routing.ListChannels(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminCreateChannel(w http.ResponseWriter, r *http.Request) {
	if s.Routing == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "路由服务未初始化", Status: 503})
		return
	}
	var body struct {
		ProviderCode string `json:"providerCode"`
		Name         string `json:"name"`
		BaseURL      string `json:"baseUrl"`
		APIKey       string `json:"apiKey"`
		Priority     int    `json:"priority"`
		Weight       int    `json:"weight"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	channel, err := s.Routing.CreateChannel(r.Context(), body.ProviderCode, body.Name, body.BaseURL, body.APIKey, body.Priority, body.Weight, currentUser(r).ID)
	if err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: err.Error(), Status: 400})
		return
	}
	ok(w, channel)
}

func (s *Server) adminUpdateChannel(w http.ResponseWriter, r *http.Request) {
	if s.Routing == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "路由服务未初始化", Status: 503})
		return
	}
	var body struct {
		Priority *int  `json:"priority"`
		Weight   *int  `json:"weight"`
		Enabled  *bool `json:"enabled"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		writeError(w, &generation.APIError{Code: "INVALID_REQUEST", Message: "请求体无效", Status: 400})
		return
	}
	if err := s.Routing.UpdateChannel(r.Context(), chi.URLParam(r, "channelID"), body.Priority, body.Weight, body.Enabled); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) adminSetChannelKey(w http.ResponseWriter, r *http.Request) {
	if s.Routing == nil {
		writeError(w, &generation.APIError{Code: "UNAVAILABLE", Message: "路由服务未初始化", Status: 503})
		return
	}
	var body struct {
		APIKey string `json:"apiKey"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if err := s.Routing.SetChannelKey(r.Context(), chi.URLParam(r, "channelID"), body.APIKey, currentUser(r).ID); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) adminListChannelKeys(w http.ResponseWriter, r *http.Request) {
	items, err := s.Routing.ListChannelKeys(r.Context(), chi.URLParam(r, "channelID"))
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminUpdateChannelKey(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled *bool `json:"enabled"`
		Weight  *int  `json:"weight"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Routing.UpdateChannelKey(r.Context(), chi.URLParam(r, "keyID"), body.Enabled, body.Weight))
}

func (s *Server) adminDeleteChannelKey(w http.ResponseWriter, r *http.Request) {
	respond(w, map[string]bool{"ok": true}, s.Routing.DeleteChannelKey(r.Context(), chi.URLParam(r, "keyID")))
}

func (s *Server) adminChannelKeyHealth(w http.ResponseWriter, r *http.Request) {
	items, err := s.Routing.KeyHealth(r.Context(), chi.URLParam(r, "channelID"))
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminDiscoverModels(w http.ResponseWriter, r *http.Request) {
	ids, err := s.Routing.DiscoverModels(r.Context(), chi.URLParam(r, "channelID"))
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": ids})
}

func (s *Server) adminEnableModel(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProviderModelID string   `json:"providerModelId"`
		DisplayName     string   `json:"displayName"`
		Modality        string   `json:"modality"`
		Capabilities    []string `json:"capabilities"`
		Credits         int64    `json:"credits"`
		LogicalKey      string   `json:"logicalKey"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	channelID := chi.URLParam(r, "channelID")
	err := s.Routing.EnableModel(r.Context(), channelID, body.ProviderModelID, body.DisplayName, body.Modality, body.Capabilities, body.Credits, body.LogicalKey)
	if err == nil {
		_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "model.enable", "channel_model", channelID, clientIP(r), nil,
			map[string]any{"providerModelId": body.ProviderModelID, "displayName": body.DisplayName, "modality": body.Modality, "credits": body.Credits})
	}
	respond(w, map[string]bool{"ok": err == nil}, err)
}

func (s *Server) adminProviderSummary(w http.ResponseWriter, r *http.Request) {
	items, err := s.Commercial.ProviderSummary(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminChannelModels(w http.ResponseWriter, r *http.Request) {
	items, err := s.Routing.ListChannelModels(r.Context(), chi.URLParam(r, "channelID"))
	if err != nil {
		writeError(w, err)
		return
	}
	ok(w, map[string]any{"items": items})
}

func (s *Server) adminSetChannelModel(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Routing.SetChannelModelEnabled(r.Context(), chi.URLParam(r, "modelID"), body.Enabled))
}
