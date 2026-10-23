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
	groups := []any{}
	if s.Routing != nil {
		if list, err := s.Routing.ListRouteGroups(r.Context()); err == nil {
			groups = make([]any, 0, len(list))
			for _, group := range list {
				groups = append(groups, map[string]any{"code": group.Code, "name": group.Name, "priceMultiplier": group.Multiplier})
			}
		}
	}
	ok(w, map[string]any{"items": rows, "settings": settings, "groups": groups})
}

func (s *Server) adminUpdatePricingSettings(w http.ResponseWriter, r *http.Request) {
	var input pricing.Settings
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	before, _ := s.Pricing.Settings(r.Context())
	settings, err := s.Pricing.UpdateSettings(r.Context(), input)
	if err == nil {
		_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "pricing.settings", "billing_settings", "true", clientIP(r),
			map[string]any{"creditCnyRate": before.CreditCNYRate, "minMarginRate": before.MinMarginRate},
			map[string]any{"creditCnyRate": settings.CreditCNYRate, "minMarginRate": settings.MinMarginRate})
	}
	respond(w, settings, err)
}

func (s *Server) adminUpdateChannelCost(w http.ResponseWriter, r *http.Request) {
	var input pricing.CostInput
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	channelModelID := chi.URLParam(r, "channelModelID")
	if err := s.Pricing.UpdateCost(r.Context(), channelModelID, input); err != nil {
		writeError(w, err)
		return
	}
	_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "pricing.cost", "channel_model", channelModelID, clientIP(r), nil,
		map[string]any{"costAmount": input.CostAmount, "currency": input.CostCurrency, "verified": input.CostVerified})
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) adminUpdateModelPrice(w http.ResponseWriter, r *http.Request) {
	var input struct {
		CreditsCost int64 `json:"creditsCost"`
	}
	if err := decode(r, &input); err != nil {
		writeError(w, err)
		return
	}
	logicalModelID := chi.URLParam(r, "logicalModelID")
	if err := s.Pricing.UpdateModelPrice(r.Context(), logicalModelID, input.CreditsCost); err != nil {
		writeError(w, err)
		return
	}
	_ = s.Commercial.RecordAdminAudit(r.Context(), currentUser(r).ID, "pricing.price", "logical_model", logicalModelID, clientIP(r), nil,
		map[string]any{"creditsCost": input.CreditsCost})
	ok(w, map[string]bool{"ok": true})
}
