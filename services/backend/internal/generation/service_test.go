package generation

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/providers"
)

type fakeProvider struct{ calls atomic.Int32 }

func (p *fakeProvider) Generate(_ context.Context, input providers.ImageRequest) (providers.ImageResult, error) {
	p.calls.Add(1)
	return providers.ImageResult{ProviderRequestID: "provider-1", Outputs: []providers.Output{{URI: "https://example.test/result.png", MediaType: "image/png"}}}, nil
}

func TestTaskIdempotencyAndPaidRequestGuard(t *testing.T) {
	provider := &fakeProvider{}
	service := NewService(true, provider, nil, nil, nil)
	request := Request{IdempotencyKey: "idem-1", ProjectID: "project", InputAssetID: "asset", Workflow: "product_image_generation", LogicalModel: "weavia-image-pro", Model: "qwen-image-2.0", Prompt: "product photo", Mode: "text_to_image", Size: "1024x1024", NumberOfImages: 1, OutputFormat: "png"}
	first, err := service.Create(context.Background(), auth.DemoUser, request)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(time.Second)
	for {
		current, _, _ := service.Get(context.Background(), auth.DemoUser.ID, first.ID)
		if current.Status == "generated" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("task did not finish")
		}
		time.Sleep(time.Millisecond)
	}
	second, err := service.Create(context.Background(), auth.DemoUser, request)
	if err != nil {
		t.Fatal(err)
	}
	if second.ID != first.ID {
		t.Fatalf("idempotency returned %s, want %s", second.ID, first.ID)
	}
	if got := provider.calls.Load(); got != 1 {
		t.Fatalf("provider calls = %d, want 1", got)
	}
	if err = service.Execute(context.Background(), first.ID); err != nil {
		t.Fatal(err)
	}
	if got := provider.calls.Load(); got != 1 {
		t.Fatalf("terminal task resent paid request: %d", got)
	}
}

func TestRealAIDisabled(t *testing.T) {
	service := NewService(false, &fakeProvider{}, nil, nil, nil)
	_, err := service.Create(context.Background(), auth.DemoUser, Request{IdempotencyKey: "x", ProjectID: "p", InputAssetID: "a", Model: "qwen-image-2.0", Prompt: "p", Mode: "text_to_image", Size: "1024x1024", NumberOfImages: 1})
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.Code != "REAL_AI_DISABLED" {
		t.Fatalf("got %#v", err)
	}
}
