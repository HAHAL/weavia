package generation

import (
	"context"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"testing"
)

func TestPreviewMatchesReservationAndRejectsChangedPrice(t *testing.T) {
	c := &fakeCredits{}
	s := NewService(true, &fakeProvider{}, fakeEnqueuer{}, nil, NewMemoryRepository()).WithCredits(c)
	req := paidRequest("preview-regression")
	req.Resolution = "2K"
	req.NumberOfImages = 2
	total, err := s.Preview(context.Background(), auth.DemoUser, req)
	if err != nil {
		t.Fatal(err)
	}
	if total != 40 || c.reserve != 0 {
		t.Fatalf("preview=%d, credits=%+v", total, c)
	}
	wrong := total - 1
	req.QuotedCost = &wrong
	if _, err = s.Create(context.Background(), auth.DemoUser, req); err == nil || c.reserve != 0 {
		t.Fatalf("changed quote must not reserve: %v %+v", err, c)
	}
	req.QuotedCost = &total
	task, err := s.Create(context.Background(), auth.DemoUser, req)
	if err != nil || task.Cost != total {
		t.Fatalf("create=%+v %v", task, err)
	}
	duplicate, err := s.Create(context.Background(), auth.DemoUser, req)
	if err != nil || duplicate.ID != task.ID || c.reserve != 1 {
		t.Fatalf("replay=%+v credits=%+v %v", duplicate, c, err)
	}
}
func TestVideoRequiresVerifiedPerSecondPricing(t *testing.T) {
	m := RegisteredModel{CreditCost: 4, Metadata: map[string]any{}}
	req := Request{Mode: "text_to_video", Duration: 5}
	if _, err := requestCost(m, req); err == nil {
		t.Fatal("unverified video permitted")
	}
	m.Metadata["videoPricingVerified"] = true
	a, _ := requestCost(m, req)
	req.Duration = 10
	b, _ := requestCost(m, req)
	if a != 20 || b != 40 {
		t.Fatalf("duration ignored: %d %d", a, b)
	}
}
