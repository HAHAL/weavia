package pricing

import "testing"

func settings() Settings {
	return Settings{CreditCNYRate: 5, FXUSDCNY: 7.1, MinMarginRate: 0.5}
}

func TestEvaluateAlibabaImageIsHealthy(t *testing.T) {
	sell, cost, margin, rate, status, _ := evaluate(10, 0.20, "CNY", "per_image", true, settings())
	if status != "ok" {
		t.Fatalf("status = %s, want ok", status)
	}
	if sell != 50 || cost != 0.20 {
		t.Fatalf("sell/cost = %v/%v", sell, cost)
	}
	if margin < 49.7 || margin > 49.9 {
		t.Fatalf("margin = %v", margin)
	}
	if rate < 0.99 {
		t.Fatalf("margin rate = %v", rate)
	}
}

func TestEvaluateBlocksBelowFloor(t *testing.T) {
	// 1 Credit = ¥1，厂商 ¥0.6，毛利率 40% < 50%
	st := Settings{CreditCNYRate: 1, FXUSDCNY: 7.1, MinMarginRate: 0.5}
	_, _, _, rate, status, reason := evaluate(1, 0.60, "CNY", "per_image", true, st)
	if status != "block" {
		t.Fatalf("status = %s, want block", status)
	}
	if rate < 0.39 || rate > 0.41 {
		t.Fatalf("margin rate = %v", rate)
	}
	if reason == "" {
		t.Fatal("expected a reason")
	}
}

func TestEvaluateExactFloorPasses(t *testing.T) {
	// 售价 ¥1，成本 ¥0.5 → 毛利率正好 50%，不拦截
	st := Settings{CreditCNYRate: 1, FXUSDCNY: 7.1, MinMarginRate: 0.5}
	_, _, _, rate, status, _ := evaluate(1, 0.50, "CNY", "per_image", true, st)
	if status != "ok" || rate != 0.5 {
		t.Fatalf("status/rate = %s/%v", status, rate)
	}
}

func TestEvaluateUSDConversion(t *testing.T) {
	_, cost, _, _, status, _ := evaluate(10, 1, "USD", "per_image", true, settings())
	if status != "ok" {
		t.Fatalf("status = %s", status)
	}
	if cost < 7.09 || cost > 7.11 {
		t.Fatalf("cost = %v, want 7.1", cost)
	}
}

func TestEvaluateUnverifiedAndPerSecond(t *testing.T) {
	if _, _, _, _, status, _ := evaluate(10, 0, "CNY", "per_image", false, settings()); status != "unverified" {
		t.Fatalf("unverified status = %s", status)
	}
	if _, _, _, _, status, _ := evaluate(10, 0.01, "USD", "per_second", true, settings()); status != "needs_duration" {
		t.Fatalf("per-second status = %s", status)
	}
}
