package generation

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/providers"
)

type fakeProvider struct{ calls atomic.Int32 }

func (p *fakeProvider) Generate(_ context.Context, input providers.ImageRequest) (providers.ImageResult, error) {
	p.calls.Add(1)
	return providers.ImageResult{ProviderRequestID: "provider-1", Outputs: []providers.Output{{URI: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==", MediaType: "image/png"}}}, nil
}

type failingProvider struct{ calls atomic.Int32 }

func (p *failingProvider) Generate(context.Context, providers.ImageRequest) (providers.ImageResult, error) {
	p.calls.Add(1)
	return providers.ImageResult{}, &providers.Error{Code: "PROVIDER_UNAVAILABLE", Message: "temporary failure", Retryable: true, Status: 503}
}

type fakeEnqueuer struct{}

func (fakeEnqueuer) Enqueue(context.Context, string) error { return nil }

type fakeCredits struct {
	reserve, confirm, release, assets int
	failConfirmOnce                   bool
}

func (c *fakeCredits) Reserve(context.Context, string, string, string, int64) (string, error) {
	c.reserve++
	return "reservation", nil
}
func (c *fakeCredits) Confirm(context.Context, string) error {
	c.confirm++
	if c.failConfirmOnce {
		c.failConfirmOnce = false
		return errors.New("temporary ledger failure")
	}
	return nil
}
func (c *fakeCredits) Release(context.Context, string) error { c.release++; return nil }
func (c *fakeCredits) RecordGeneratedAsset(context.Context, string, string, string, string, string, string, string, string, int64) error {
	c.assets++
	return nil
}
func paidRequest(key string) Request {
	return Request{IdempotencyKey: key, ProjectID: "project", InputAssetID: "asset", Workflow: "product_image_generation", LogicalModel: "weavia-image-pro", Model: "qwen-image-2.0", Prompt: "photo", Mode: "text_to_image", Size: "1024x1024", NumberOfImages: 1, OutputFormat: "png"}
}

func TestCommercialSuccessFailureAndRetry(t *testing.T) {
	ctx := context.Background()
	good := &fakeProvider{}
	credits := &fakeCredits{}
	service := NewService(true, good, fakeEnqueuer{}, nil, NewMemoryRepository()).WithCredits(credits).WithStorage(assets.New(t.TempDir(), "test-secret"))
	task, err := service.Create(ctx, auth.DemoUser, paidRequest("commercial-good"))
	if err != nil {
		t.Fatal(err)
	}
	if task.Cost != 10 || task.Provider != "antdigital" {
		t.Fatalf("routing/cost: %#v", task)
	}
	if err = service.Execute(ctx, task.ID); err != nil {
		t.Fatal(err)
	}
	if err = service.Execute(ctx, task.ID); err != nil {
		t.Fatal(err)
	}
	if good.calls.Load() != 1 || credits.reserve != 1 || credits.confirm != 1 || credits.release != 0 || credits.assets != 1 {
		t.Fatalf("success counts: provider=%d credits=%+v", good.calls.Load(), credits)
	}
	duplicate, err := service.Create(ctx, auth.DemoUser, paidRequest("commercial-good"))
	if err != nil || duplicate.ID != task.ID || good.calls.Load() != 1 {
		t.Fatalf("duplicate: %#v %v", duplicate, err)
	}

	bad := &failingProvider{}
	failedCredits := &fakeCredits{}
	failed := NewService(true, bad, fakeEnqueuer{}, nil, NewMemoryRepository()).WithCredits(failedCredits)
	failedTask, err := failed.Create(ctx, auth.DemoUser, paidRequest("commercial-bad"))
	if err != nil {
		t.Fatal(err)
	}
	if err = failed.Execute(ctx, failedTask.ID); err == nil {
		t.Fatal("expected provider error")
	}
	if err = failed.Execute(ctx, failedTask.ID); err != nil {
		t.Fatal(err)
	}
	if bad.calls.Load() != 1 || failedCredits.reserve != 1 || failedCredits.release != 2 || failedCredits.confirm != 0 {
		t.Fatalf("failure/retry counts: provider=%d credits=%+v", bad.calls.Load(), failedCredits)
	}
}
func TestReconciliationRetryDoesNotCallProviderAgain(t *testing.T) {
	ctx := context.Background()
	provider := &fakeProvider{}
	credits := &fakeCredits{failConfirmOnce: true}
	service := NewService(true, provider, fakeEnqueuer{}, nil, NewMemoryRepository()).WithCredits(credits).WithStorage(assets.New(t.TempDir(), "test-secret"))
	task, err := service.Create(ctx, auth.DemoUser, paidRequest("reconcile-once"))
	if err != nil {
		t.Fatal(err)
	}
	if err = service.Execute(ctx, task.ID); err == nil {
		t.Fatal("expected settlement error")
	}
	if err = service.Execute(ctx, task.ID); err != nil {
		t.Fatal(err)
	}
	current, _, err := service.Get(ctx, auth.DemoUser.ID, task.ID)
	if err != nil || current.Status != "success" || provider.calls.Load() != 1 || credits.confirm != 2 {
		t.Fatalf("reconcile result: %#v provider=%d credits=%+v err=%v", current, provider.calls.Load(), credits, err)
	}
}

func TestMissingGeneratedFileBlocksCreditsConfirmation(t *testing.T) {
	ctx := context.Background()
	provider := &fakeProvider{}
	credits := &fakeCredits{failConfirmOnce: true}
	storage := assets.New(t.TempDir(), "test-secret")
	service := NewService(true, provider, fakeEnqueuer{}, nil, NewMemoryRepository()).WithCredits(credits).WithStorage(storage)
	task, err := service.Create(ctx, auth.DemoUser, paidRequest("missing-file"))
	if err != nil {
		t.Fatal(err)
	}
	if err = service.Execute(ctx, task.ID); err == nil {
		t.Fatal("expected settlement failure")
	}
	current, _, err := service.Get(ctx, auth.DemoUser.ID, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Remove(filepath.Join(storage.Root, filepath.FromSlash(current.Outputs[0].ObjectKey))); err != nil {
		t.Fatal(err)
	}
	if err = service.Execute(ctx, task.ID); err == nil {
		t.Fatal("missing file must block confirmation")
	}
	if credits.confirm != 1 || provider.calls.Load() != 1 {
		t.Fatalf("confirmation/provider repeated: %+v %d", credits, provider.calls.Load())
	}
}

func TestTaskIdempotencyAndPaidRequestGuard(t *testing.T) {
	provider := &fakeProvider{}
	service := NewService(true, provider, nil, nil, nil).WithStorage(assets.New(t.TempDir(), "test-secret"))
	request := Request{IdempotencyKey: "idem-1", ProjectID: "project", InputAssetID: "asset", Workflow: "product_image_generation", LogicalModel: "weavia-image-pro", Model: "qwen-image-2.0", Prompt: "product photo", Mode: "text_to_image", Size: "1024x1024", NumberOfImages: 1, OutputFormat: "png"}
	first, err := service.Create(context.Background(), auth.DemoUser, request)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(time.Second)
	for {
		current, _, _ := service.Get(context.Background(), auth.DemoUser.ID, first.ID)
		if current.Status == "success" {
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

func TestMockModeAllowsTextToImageWithoutProject(t *testing.T) {
	ctx := context.Background()
	credits := &fakeCredits{}
	storage := assets.New(t.TempDir(), "test-secret")
	service := NewService(false, &providers.Mock{}, fakeEnqueuer{}, nil, NewMemoryRepository()).WithCredits(credits).WithStorage(storage).WithMock(true)
	request := Request{IdempotencyKey: "mock-text", Model: "qwen-image-max", Prompt: "a clean product photo", Mode: "text_to_image", Size: "1024x1024", NumberOfImages: 1, OutputFormat: "png"}
	task, err := service.Create(ctx, auth.DemoUser, request)
	if err != nil {
		t.Fatal(err)
	}
	if task.Cost != 30 {
		t.Fatalf("cost = %d, want 30", task.Cost)
	}
	if err = service.Execute(ctx, task.ID); err != nil {
		t.Fatal(err)
	}
	current, _, err := service.Get(ctx, auth.DemoUser.ID, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Status != "success" || len(current.Outputs) != 1 || current.Outputs[0].ObjectKey == "" {
		t.Fatalf("unexpected task: %#v", current)
	}
	if credits.reserve != 1 || credits.confirm != 1 || credits.release != 0 || credits.assets != 1 {
		t.Fatalf("credits: %+v", credits)
	}
}
