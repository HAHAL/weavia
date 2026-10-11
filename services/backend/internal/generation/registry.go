package generation

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

type RegisteredModel struct {
	Name         string
	Provider     string
	Enabled      bool
	CreditCost   int64
	Capabilities []string
	Metadata     map[string]any
}
type Registry interface {
	Lookup(context.Context, string) (RegisteredModel, error)
}
type PostgresRegistry struct{ Pool *pgxpool.Pool }

func (r PostgresRegistry) Lookup(ctx context.Context, name string) (RegisteredModel, error) {
	var m RegisteredModel
	var capabilities, metadata []byte
	err := r.Pool.QueryRow(ctx, `SELECT m.model_name,p.code,(m.enabled AND p.enabled),m.credit_cost,m.capabilities,m.metadata FROM ai_models m JOIN ai_providers p ON p.id=m.provider_id WHERE m.model_name=$1`, name).Scan(&m.Name, &m.Provider, &m.Enabled, &m.CreditCost, &capabilities, &metadata)
	if err != nil {
		return m, err
	}
	if err = json.Unmarshal(capabilities, &m.Capabilities); err != nil {
		return m, err
	}
	if err = json.Unmarshal(metadata, &m.Metadata); err != nil {
		return m, err
	}
	return m, nil
}

type StaticRegistry struct{ Models map[string]RegisteredModel }

func (r StaticRegistry) Lookup(_ context.Context, name string) (RegisteredModel, error) {
	m, ok := r.Models[name]
	if !ok {
		return m, errors.New("model not found")
	}
	return m, nil
}
func DefaultTestRegistry() StaticRegistry {
	models := map[string]RegisteredModel{}
	for _, item := range Models {
		provider := "antdigital"
		if item.ProviderID == dashScopeProviderID {
			provider = "dashscope"
		}
		models[item.ModelID] = RegisteredModel{Name: item.ModelID, Provider: provider, Enabled: item.Enabled, CreditCost: int64(item.CreditsCost), Capabilities: item.Capabilities, Metadata: item.Metadata}
	}
	return StaticRegistry{Models: models}
}
