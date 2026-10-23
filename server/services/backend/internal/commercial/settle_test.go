package commercial

import "testing"

func TestSettleKeepByDeliveredOutputs(t *testing.T) {
	// 4 张预扣 40 Credits，只交付 2 张 → 扣 20
	if got := settleKeep(40, 40, 4, 2, "delivered"); got != 20 {
		t.Fatalf("keep = %d, want 20", got)
	}
}

func TestSettleKeepSubmittedChargesFull(t *testing.T) {
	// 渠道提交即计费：少返也要按请求数量扣，避免倒贴
	if got := settleKeep(40, 40, 4, 2, "submitted"); got != 40 {
		t.Fatalf("keep = %d, want 40", got)
	}
}

func TestSettleKeepZeroDelivered(t *testing.T) {
	if got := settleKeep(40, 40, 4, 0, "delivered"); got != 0 {
		t.Fatalf("keep = %d, want 0", got)
	}
}

func TestSettleKeepClampsDelivered(t *testing.T) {
	if got := settleKeep(40, 40, 4, 9, "delivered"); got != 40 {
		t.Fatalf("keep = %d, want 40", got)
	}
}

func TestSettleKeepClampsToReserved(t *testing.T) {
	// 预扣金额小于按成本折算的金额时，不能多扣
	if got := settleKeep(40, 30, 4, 4, "delivered"); got != 30 {
		t.Fatalf("keep = %d, want 30", got)
	}
}

func TestSettleKeepFallsBackToReserved(t *testing.T) {
	// 任务成本缺失时用预扣金额等分，避免整单免费
	if got := settleKeep(0, 40, 4, 2, "delivered"); got != 20 {
		t.Fatalf("keep = %d, want 20", got)
	}
}

func TestSettleKeepSingleUnit(t *testing.T) {
	if got := settleKeep(50, 50, 1, 1, "delivered"); got != 50 {
		t.Fatalf("keep = %d, want 50", got)
	}
	if got := settleKeep(50, 50, 1, 0, "delivered"); got != 0 {
		t.Fatalf("keep = %d, want 0", got)
	}
}
