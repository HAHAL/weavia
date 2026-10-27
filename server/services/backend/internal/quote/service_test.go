package quote

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type fakeStore struct {
	q Quote
}

func (f *fakeStore) Create(_ context.Context, q Quote) (Quote, error) {
	q.ID = "q1"
	f.q = q
	return q, nil
}
func (f *fakeStore) Get(_ context.Context, userID, id string) (Quote, error) {
	if id != "q1" || userID != "u1" {
		return Quote{}, pgx.ErrNoRows
	}
	return f.q, nil
}
func (f *fakeStore) Consume(_ context.Context, userID, id string) (Quote, error) {
	if id != "q1" || userID != "u1" {
		return Quote{}, pgx.ErrNoRows
	}
	if f.q.Status != "active" {
		return Quote{}, pgx.ErrNoRows
	}
	f.q.Status = "consumed"
	return f.q, nil
}

type fakePricer struct{}

func (fakePricer) Price(context.Context, string) (ModelPrice, error) {
	return ModelPrice{Credits: 30, Enabled: true, Capabilities: []string{"text_to_image", "image_edit"}}, nil
}

func newTestService() (*Service, *fakeStore) {
	store := &fakeStore{}
	svc := New(store, fakePricer{})
	svc.now = func() time.Time { return time.Date(2026, 10, 20, 10, 0, 0, 0, time.UTC) }
	return svc, store
}

func TestCreateQuoteAndValidate(t *testing.T) {
	svc, _ := newTestService()
	q, err := svc.Create(context.Background(), "u1", Request{Model: "qwen-image-max", Mode: "text_to_image", Prompt: "a product", Size: "1024x1024", NumberOfImages: 1}, "idem-1")
	if err != nil || q.TotalCredits != 30 || q.Status != "active" {
		t.Fatalf("create: %#v %v", q, err)
	}
	got, err := svc.ValidateForTask(context.Background(), "u1", "q1", Request{Model: "qwen-image-max", Mode: "text_to_image", Prompt: "a product", Size: "1024x1024", NumberOfImages: 1})
	if err != nil || got.ID != "q1" {
		t.Fatalf("validate: %#v %v", got, err)
	}
	_, err = svc.ValidateForTask(context.Background(), "u1", "q1", Request{Model: "qwen-image-max", Mode: "text_to_image", Prompt: "different prompt", Size: "1024x1024", NumberOfImages: 1})
	if apiErr, ok := err.(*generation.APIError); !ok || apiErr.Code != "QUOTE_MISMATCH" {
		t.Fatalf("prompt mismatch: %#v", err)
	}
	_, err = svc.ValidateForTask(context.Background(), "u1", "q1", Request{Model: "qwen-image-2.0", Mode: "text_to_image", Prompt: "a product", Size: "1024x1024", NumberOfImages: 1})
	apiErr, ok := err.(*generation.APIError)
	if !ok || apiErr.Code != "QUOTE_MISMATCH" {
		t.Fatalf("mismatch: %#v", err)
	}
	if _, err = svc.Consume(context.Background(), "u1", "q1"); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Consume(context.Background(), "u1", "q1"); err == nil {
		t.Fatal("expected second consume to fail")
	}
}

func TestExpiredQuote(t *testing.T) {
	svc, _ := newTestService()
	if _, err := svc.Create(context.Background(), "u1", Request{Model: "qwen-image-max", Mode: "text_to_image", Prompt: "a product", Size: "1024x1024", NumberOfImages: 1}, "idem-2"); err != nil {
		t.Fatal(err)
	}
	svc.now = func() time.Time { return time.Date(2026, 10, 20, 10, 6, 0, 0, time.UTC) }
	_, err := svc.ValidateForTask(context.Background(), "u1", "q1", Request{Model: "qwen-image-max", Mode: "text_to_image", Prompt: "a product", Size: "1024x1024", NumberOfImages: 1})
	apiErr, ok := err.(*generation.APIError)
	if !ok || apiErr.Code != "QUOTE_EXPIRED" {
		t.Fatalf("expired: %#v", err)
	}
}

func TestPricedQuoteLocksDurationResolutionAndRoute(t *testing.T) {
	svc, _ := newTestService()
	req := Request{Model: "video", ModelKey: "route-a", Mode: "text_to_video", Prompt: "product", Size: "1280x720", NumberOfImages: 1, Duration: 5, Resolution: "1K"}
	q, err := svc.CreatePriced(context.Background(), "u1", req, 20)
	if err != nil || q.TotalCredits != 20 {
		t.Fatalf("quote: %+v %v", q, err)
	}
	for _, change := range []func(*Request){func(r *Request) { r.Duration = 10 }, func(r *Request) { r.Resolution = "2K" }, func(r *Request) { r.ModelKey = "route-b" }} {
		other := req
		change(&other)
		if _, err = svc.ValidateForTask(context.Background(), "u1", "q1", other); err == nil {
			t.Fatal("mutated request accepted")
		}
	}
	if _, err = svc.ValidateForTask(context.Background(), "other-account", "q1", req); err == nil {
		t.Fatal("another account accepted")
	}
}
