package modelcatalog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/providerconfig"
)

type Model struct {
	ID           string   `json:"id"`
	DisplayName  string   `json:"displayName"`
	Provider     string   `json:"provider"`
	Modality     string   `json:"modality"`
	Capabilities []string `json:"capabilities"`
	Available    bool     `json:"available"`
	CreditsCost  int64    `json:"creditsCost,omitempty"`
	Source       string   `json:"source"`
}

type Service struct {
	pool          *pgxpool.Pool
	creds         *providerconfig.Service
	antBase       string
	dashBase      string
	antEnvKey     string
	dashEnvKey    string
	compKey       string
	compModelsURL string
	client        *http.Client
}

func New(pool *pgxpool.Pool, creds *providerconfig.Service, antBase, dashBase, antKey, dashKey, compKey, compModelsURL string) *Service {
	return &Service{pool: pool, creds: creds, antBase: strings.TrimRight(antBase, "/"), dashBase: strings.TrimRight(dashBase, "/"), antEnvKey: antKey, dashEnvKey: dashKey, compKey: compKey, compModelsURL: strings.TrimRight(compModelsURL, "/"), client: &http.Client{Timeout: 12 * time.Second}}
}

func (s *Service) List(ctx context.Context) ([]Model, error) {
	items := []Model{}
	ant, err := s.listAntDigital(ctx)
	if err == nil {
		items = append(items, ant...)
	}
	dash, derr := s.listDashScope(ctx)
	if derr == nil {
		items = append(items, dash...)
	}
	items = append(items, s.listComputrix(ctx)...)
	hasProvider := func(code string) bool {
		for _, item := range items {
			if item.Provider == code {
				return true
			}
		}
		return false
	}
	for _, code := range []string{"antdigital", "dashscope"} {
		if hasProvider(code) {
			continue
		}
		for _, fallback := range fallbackModels() {
			if fallback.Provider == code {
				items = append(items, fallback)
			}
		}
	}
	// Video requests are currently implemented by the DashScope video adapter.
	// Keep its catalog entry visible for setup even if the provider's models
	// endpoint does not list video models, but never mark it usable by default.
	for _, fallback := range fallbackModels() {
		if fallback.Modality != "video" {
			continue
		}
		exists := false
		for _, item := range items {
			if item.Provider == fallback.Provider && item.ID == fallback.ID {
				exists = true
				break
			}
		}
		if !exists {
			items = append(items, fallback)
		}
	}
	s.applyRegistry(ctx, items)
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Modality != items[j].Modality {
			return modalityRank(items[i].Modality) < modalityRank(items[j].Modality)
		}
		if items[i].Provider != items[j].Provider {
			return items[i].Provider < items[j].Provider
		}
		return strings.ToLower(items[i].DisplayName) < strings.ToLower(items[j].DisplayName)
	})
	return items, nil
}

func modalityRank(value string) int {
	switch value {
	case "image":
		return 0
	case "video":
		return 1
	default:
		return 2
	}
}

func (s *Service) listAntDigital(ctx context.Context) ([]Model, error) {
	key, err := s.key(ctx, "antdigital", s.antEnvKey)
	if err != nil || key == "" {
		return nil, fmt.Errorf("antdigital key unavailable")
	}
	items := []Model{}
	after := ""
	for page := 0; page < 5; page++ {
		query := "?limit=100"
		if after != "" {
			query += "&after=" + url.QueryEscape(after)
		}
		raw, err := s.get(ctx, s.antBase+"/models"+query, key)
		if err != nil {
			return nil, err
		}
		var payload struct {
			Data    []map[string]any `json:"data"`
			HasMore bool             `json:"has_more"`
			LastID  string           `json:"last_id"`
		}
		if err = json.Unmarshal(raw, &payload); err != nil {
			return nil, err
		}
		for _, row := range payload.Data {
			id := stringField(row, "id", "model", "model_name")
			if id == "" {
				continue
			}
			modality := classify(id)
			if modality == "text" {
				continue
			}
			items = append(items, Model{ID: id, DisplayName: displayName(row, id), Provider: "antdigital", Modality: modality, Capabilities: capabilities(modality), Source: "provider"})
		}
		if !payload.HasMore || payload.LastID == "" {
			break
		}
		after = payload.LastID
	}
	return items, nil
}

func (s *Service) listComputrix(ctx context.Context) []Model {
	key, _ := s.key(ctx, "computrix", s.compKey)
	if key == "" {
		return nil
	}
	items := []Model{}
	if s.compModelsURL != "" {
		if raw, err := s.get(ctx, s.compModelsURL, key); err == nil {
			var payload struct {
				Data []map[string]any `json:"data"`
			}
			if json.Unmarshal(raw, &payload) == nil {
				for _, row := range payload.Data {
					id := stringField(row, "id", "model", "model_name")
					if id == "" {
						continue
					}
					modality := classify(id)
					if modality == "text" {
						continue
					}
					credits := int64(20)
					if modality == "video" {
						credits = 50
					}
					items = append(items, Model{ID: id, DisplayName: displayName(row, id), Provider: "computrix", Modality: modality, Capabilities: capabilities(modality), Available: true, CreditsCost: credits, Source: "provider"})
				}
			}
		}
	}
	if len(items) > 0 {
		return items
	}
	// Catalog fallback when computrix.ai /v1/models is temporarily unavailable.
	return []Model{
		{ID: "qwen-image-2.0", DisplayName: "Qwen Image 2.0", Provider: "computrix", Modality: "image", Capabilities: []string{"text_to_image", "image_to_image"}, Available: true, CreditsCost: 10, Source: "catalog"},
		{ID: "gemini-3.1-flash-image", DisplayName: "Gemini 3.1 Flash Image", Provider: "computrix", Modality: "image", Capabilities: []string{"text_to_image"}, Available: true, CreditsCost: 20, Source: "catalog"},
		{ID: "nano-banana-2", DisplayName: "Nano Banana 2", Provider: "computrix", Modality: "image", Capabilities: []string{"text_to_image"}, Available: true, CreditsCost: 20, Source: "catalog"},
		{ID: "nano-banana-pro", DisplayName: "Nano Banana Pro", Provider: "computrix", Modality: "image", Capabilities: []string{"text_to_image"}, Available: true, CreditsCost: 50, Source: "catalog"},
	}
}

func (s *Service) listDashScope(ctx context.Context) ([]Model, error) {
	key, err := s.key(ctx, "dashscope", s.dashEnvKey)
	if err != nil || key == "" {
		return nil, fmt.Errorf("dashscope key unavailable")
	}
	raw, err := s.get(ctx, s.dashBase+"/models", key)
	if err != nil {
		return nil, err
	}
	var payload struct {
		Data []map[string]any `json:"data"`
	}
	if err = json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	items := []Model{}
	for _, row := range payload.Data {
		id := stringField(row, "id", "model", "model_name")
		if id == "" {
			continue
		}
		modality := classify(id)
		if modality == "text" {
			continue
		}
		items = append(items, Model{ID: id, DisplayName: displayName(row, id), Provider: "dashscope", Modality: modality, Capabilities: capabilities(modality), Source: "provider"})
	}
	return items, nil
}

func (s *Service) get(ctx context.Context, endpoint, key string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	response, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("provider models endpoint returned %d", response.StatusCode)
	}
	return body, nil
}

func (s *Service) key(ctx context.Context, provider, fallback string) (string, error) {
	if s.creds != nil {
		value, err := s.creds.Get(ctx, provider)
		if err == nil && value != "" {
			return value, nil
		}
	}
	return fallback, nil
}

func (s *Service) applyRegistry(ctx context.Context, items []Model) {
	if s.pool == nil {
		return
	}
	ready := map[string]bool{"antdigital": s.antEnvKey != "", "dashscope": s.dashEnvKey != "", "computrix": s.compKey != ""}
	if s.creds != nil {
		if statuses, err := s.creds.Statuses(ctx); err == nil {
			for code, status := range statuses {
				if status.Configured {
					ready[code] = true
				}
			}
		}
	}
	rows, err := s.pool.Query(ctx, `SELECT m.model_name,p.code,m.enabled,coalesce(m.credit_cost,0),m.capabilities FROM ai_models m JOIN ai_providers p ON p.id=m.provider_id`)
	if err != nil {
		return
	}
	defer rows.Close()
	type entry struct {
		enabled bool
		credits int64
		caps    []string
	}
	known := map[string]entry{}
	for rows.Next() {
		var name, provider string
		var enabled bool
		var credits int64
		var caps []byte
		if rows.Scan(&name, &provider, &enabled, &credits, &caps) != nil {
			continue
		}
		var values []string
		_ = json.Unmarshal(caps, &values)
		known[provider+"/"+name] = entry{enabled, credits, values}
	}
	for i := range items {
		if items[i].Modality == "video" && items[i].Provider != "dashscope" {
			items[i].Available = false
			continue
		}
		if !ready[items[i].Provider] {
			items[i].Available = false
			continue
		}
		if item, ok := known[items[i].Provider+"/"+items[i].ID]; ok {
			items[i].Available = item.enabled && item.credits > 0
			items[i].CreditsCost = item.credits
			if len(item.caps) > 0 {
				items[i].Capabilities = item.caps
			}
		} else if items[i].Modality == "video" {
			items[i].Available = false
		}
	}
}

func fallbackModels() []Model {
	items := []Model{
		{ID: "qwen-image-max", DisplayName: "Qwen Image Max", Provider: "antdigital", Modality: "image", Capabilities: []string{"text_to_image"}, Available: true, CreditsCost: 30, Source: "catalog"},
		{ID: "qwen-image-2.0", DisplayName: "Qwen Image 2.0", Provider: "antdigital", Modality: "image", Capabilities: []string{"text_to_image", "image_to_image"}, Available: true, CreditsCost: 10, Source: "catalog"},
		{ID: "wan2.7-image", DisplayName: "Wan2.7 Image", Provider: "dashscope", Modality: "image", Capabilities: []string{"text_to_image", "image_to_image", "image_edit"}, Available: true, CreditsCost: 40, Source: "catalog"},
		{ID: "qwen-image-2.1-pro", DisplayName: "Qwen Image 2.1 Pro", Provider: "dashscope", Modality: "image", Capabilities: []string{"text_to_image", "image_to_image", "image_edit"}, Available: true, CreditsCost: 45, Source: "catalog"},
		{ID: "wanx2.1-imageedit", DisplayName: "Wan2.1 Image Edit", Provider: "dashscope", Modality: "image", Capabilities: []string{"image_to_image", "image_edit"}, Available: true, CreditsCost: 50, Source: "catalog"},
		{ID: "wan2.7-t2v", DisplayName: "Wan2.7 Text to Video", Provider: "dashscope", Modality: "video", Capabilities: []string{"text_to_video"}, Source: "catalog"},
	}
	return items
}

func classify(id string) string {
	value := strings.ToLower(id)
	switch {
	case strings.Contains(value, "video"), strings.Contains(value, "t2v"), strings.Contains(value, "i2v"), strings.Contains(value, "r2v"):
		return "video"
	case strings.Contains(value, "image"), strings.Contains(value, "t2i"), strings.Contains(value, "imageedit"), strings.Contains(value, "image-edit"):
		return "image"
	default:
		return "text"
	}
}

func capabilities(modality string) []string {
	if modality == "video" {
		return []string{"text_to_video"}
	}
	return []string{"text_to_image"}
}

func stringField(row map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := row[key].(string); ok && value != "" {
			return value
		}
	}
	return ""
}

func displayName(row map[string]any, fallback string) string {
	if value := stringField(row, "display_name", "displayName", "name"); value != "" {
		return value
	}
	return fallback
}

func (m Model) String() string { return m.Provider + "/" + m.ID }
