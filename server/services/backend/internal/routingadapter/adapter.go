package routingadapter

import (
	"context"
	"time"

	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/routing"
)

type Adapter struct{ service *routing.Service }

func New(service *routing.Service) *Adapter { return &Adapter{service: service} }

func (a *Adapter) LookupRoute(ctx context.Context, key string) (generation.RouteModel, error) {
	item, err := a.service.Lookup(ctx, key)
	if err != nil {
		return generation.RouteModel{}, err
	}
	return generation.RouteModel{Key: item.Key, DisplayName: item.DisplayName, CreditsCost: item.CreditsCost, Capabilities: item.Capabilities}, nil
}

func (a *Adapter) BindingsFor(ctx context.Context, key string) ([]generation.RouteBinding, error) {
	bindings, err := a.service.Bindings(ctx, key)
	if err != nil {
		return nil, err
	}
	out := make([]generation.RouteBinding, 0, len(bindings))
	for _, item := range bindings {
		out = append(out, generation.RouteBinding{ID: item.ID, ChannelID: item.ChannelID, ChannelModelID: item.ChannelModelID, ChannelName: item.ChannelName, Provider: item.Provider, ProviderModelID: item.ProviderModelID, BaseURL: item.BaseURL, APIKey: item.APIKey, KeyID: item.KeyID, Priority: item.Priority, Weight: item.Weight})
	}
	return out, nil
}

func (a *Adapter) BindingsForAccount(ctx context.Context, userID, key string) ([]generation.RouteBinding, error) {
	bindings, err := a.service.BindingsForAccount(ctx, userID, key)
	if err != nil {
		return nil, err
	}
	out := make([]generation.RouteBinding, 0, len(bindings))
	for _, item := range bindings {
		out = append(out, generation.RouteBinding{ID: item.ID, ChannelID: item.ChannelID, ChannelModelID: item.ChannelModelID, ChannelName: item.ChannelName, Provider: item.Provider, ProviderModelID: item.ProviderModelID, BaseURL: item.BaseURL, APIKey: item.APIKey, KeyID: item.KeyID, Priority: item.Priority, Weight: item.Weight})
	}
	return out, nil
}

func (a *Adapter) RecordRoute(ctx context.Context, bindingID string, failure error) {
	a.service.RecordResult(ctx, bindingID, failure)
}
func (a *Adapter) LogRoute(ctx context.Context, taskID, key, channelID, channelModelID, providerModelID, keyID string, attempt int, status, errorCode string, latency time.Duration) {
	a.service.LogAttempt(ctx, taskID, key, channelID, channelModelID, providerModelID, keyID, attempt, status, errorCode, latency)
}
func (a *Adapter) Retryable(err error) bool { return routing.Retryable(err) }
