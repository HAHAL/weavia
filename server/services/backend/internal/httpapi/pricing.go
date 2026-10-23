package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/weavia/weavia/services/backend/internal/pricing"
)

func (s *Server) adminPricing(w http.ResponseWriter, r *http.Request) {
	if s.Pricing == nil {
		ok(w, map[string]any{"items": []any{}, "settings": pricing.Settings{CreditCNYRate: 5, FXUSDCNY: 7.1, MinMarginRate: 0.5}})
		return
	}
	rows, settings, err := s.Pricing.List(r.Context())
	if err != nil {
		respond(w, nil, err)
		return
	}
	ok(w, map[string]any{"items": rows, "settings": settings})
}

func (s *Server) adminUpdatePricingSettings(w http.ResponseWriter, r *http.Request) {
	var input pricing.Settings
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	settings, err := s.Pricing.UpdateSettings(r.Context(), input)
	respond(w, settings, err)
}

func (s *Server) adminUpdateChannelCost(w http.ResponseWriter, r *http.Request) {
	var input pricing.CostInput
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Pricing.UpdateCost(r.Context(), chi.URLParam(r, "channelModelID"), input))
}

func (s *Server) adminUpdateModelPrice(w http.ResponseWriter, r *http.Request) {
	var input struct {
		CreditsCost int64 `json:"creditsCost"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	respond(w, map[string]bool{"ok": true}, s.Pricing.UpdateModelPrice(r.Context(), chi.URLParam(r, "logicalModelID"), input.CreditsCost))
}
