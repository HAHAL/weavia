// Package pricing 维护厂商原价、售价与毛利率，并在付费提交前拦截亏损模型。
package pricing

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Settings struct {
	CreditCNYRate float64 `json:"creditCnyRate"`
	FXUSDCNY      float64 `json:"fxUsdCny"`
	MinMarginRate float64 `json:"minMarginRate"`
}

type Row struct {
	LogicalModelID string  `json:"logicalModelId"`
	Key            string  `json:"key"`
	DisplayName    string  `json:"displayName"`
	CreditsCost    int64   `json:"creditsCost"`
	ChannelID      string  `json:"channelId"`
	ChannelName    string  `json:"channelName"`
	ChannelModelID string  `json:"channelModelId"`
	ProviderModel  string  `json:"providerModelId"`
	CostAmount     float64 `json:"costAmount"`
	CostCurrency   string  `json:"costCurrency"`
	CostUnit       string  `json:"costUnit"`
	TaxIncluded    bool    `json:"taxIncluded"`
	CostVerified   bool    `json:"costVerified"`
	CostSource     string  `json:"costSource"`
	CostNote       string  `json:"costNote"`
	SellCNY        float64 `json:"sellCny"`
	CostCNY        float64 `json:"costCny"`
	MarginCNY      float64 `json:"marginCny"`
	MarginRate     float64 `json:"marginRate"`
	Status         string  `json:"status"`
	Reason         string  `json:"reason"`
}

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

func (s *Service) Settings(ctx context.Context) (Settings, error) {
	var st Settings
	err := s.pool.QueryRow(ctx, `SELECT credit_cny_rate::float8, fx_usd_cny::float8, min_margin_rate::float8 FROM billing_settings WHERE id=true`).
		Scan(&st.CreditCNYRate, &st.FXUSDCNY, &st.MinMarginRate)
	return st, err
}

func (s *Service) UpdateSettings(ctx context.Context, st Settings) (Settings, error) {
	if st.CreditCNYRate <= 0 || st.CreditCNYRate > 100000 {
		return Settings{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "Credit 汇率必须在 0 到 100000 之间", Status: 400}
	}
	if st.FXUSDCNY <= 0 || st.FXUSDCNY > 100 {
		return Settings{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "美元汇率必须在 0 到 100 之间", Status: 400}
	}
	if st.MinMarginRate < 0 || st.MinMarginRate >= 1 {
		return Settings{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "最低毛利率必须在 0 到 1 之间", Status: 400}
	}
	_, err := s.pool.Exec(ctx, `UPDATE billing_settings SET credit_cny_rate=$1, fx_usd_cny=$2, min_margin_rate=$3, updated_at=now() WHERE id=true`, st.CreditCNYRate, st.FXUSDCNY, st.MinMarginRate)
	if err != nil {
		return Settings{}, err
	}
	return s.Settings(ctx)
}

func (s *Service) List(ctx context.Context) ([]Row, Settings, error) {
	st, err := s.Settings(ctx)
	if err != nil {
		return nil, Settings{}, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(lm.id::text,''), COALESCE(lm.key,''), COALESCE(lm.display_name,''), COALESCE(lm.credits_cost,0),
		       pc.id::text, pc.name, cm.id::text, cm.provider_model_id,
		       cm.cost_amount::float8, cm.cost_currency, cm.cost_unit, cm.tax_included, cm.cost_verified, cm.cost_source, cm.cost_note
		FROM channel_models cm
		JOIN provider_channels pc ON pc.id = cm.channel_id
		LEFT JOIN logical_model_abilities mr ON mr.channel_model_id = cm.id
		LEFT JOIN logical_models lm ON lm.id = mr.logical_model_id
		ORDER BY lm.display_name NULLS LAST, pc.name, cm.provider_model_id`)
	if err != nil {
		return nil, Settings{}, err
	}
	defer rows.Close()
	out := make([]Row, 0, 32)
	for rows.Next() {
		var row Row
		if err := rows.Scan(&row.LogicalModelID, &row.Key, &row.DisplayName, &row.CreditsCost, &row.ChannelID, &row.ChannelName, &row.ChannelModelID, &row.ProviderModel,
			&row.CostAmount, &row.CostCurrency, &row.CostUnit, &row.TaxIncluded, &row.CostVerified, &row.CostSource, &row.CostNote); err != nil {
			return nil, Settings{}, err
		}
		row.SellCNY, row.CostCNY, row.MarginCNY, row.MarginRate, row.Status, row.Reason = evaluate(row.CreditsCost, row.CostAmount, row.CostCurrency, row.CostUnit, row.CostVerified, st)
		out = append(out, row)
	}
	return out, st, rows.Err()
}

type CostInput struct {
	CostAmount   float64 `json:"costAmount"`
	CostCurrency string  `json:"costCurrency"`
	CostUnit     string  `json:"costUnit"`
	TaxIncluded  bool    `json:"taxIncluded"`
	CostVerified bool    `json:"costVerified"`
	CostSource   string  `json:"costSource"`
	CostNote     string  `json:"costNote"`
}

func (s *Service) UpdateCost(ctx context.Context, channelModelID string, in CostInput) error {
	if in.CostAmount < 0 || in.CostAmount > 100000 {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "成本金额不合法", Status: 400}
	}
	currency := strings.ToUpper(strings.TrimSpace(in.CostCurrency))
	if currency == "" {
		currency = "CNY"
	}
	if currency != "CNY" && currency != "USD" {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "成本币种只支持 CNY / USD", Status: 400}
	}
	unit := strings.TrimSpace(in.CostUnit)
	if unit == "" {
		unit = "per_image"
	}
	if unit != "per_image" && unit != "per_second" {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "计费单位只支持 per_image / per_second", Status: 400}
	}
	tag, err := s.pool.Exec(ctx, `UPDATE channel_models SET cost_amount=$2, cost_currency=$3, cost_unit=$4, tax_included=$5, cost_verified=$6, cost_source=$7, cost_note=$8 WHERE id=$1`,
		channelModelID, in.CostAmount, currency, unit, in.TaxIncluded, in.CostVerified, strings.TrimSpace(in.CostSource), strings.TrimSpace(in.CostNote))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &generation.APIError{Code: "NOT_FOUND", Message: "渠道模型不存在", Status: 404}
	}
	return nil
}

func (s *Service) UpdateModelPrice(ctx context.Context, logicalModelID string, credits int64) error {
	if credits < 0 || credits > 1000000 {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: "售价 Credits 不合法", Status: 400}
	}
	tag, err := s.pool.Exec(ctx, `UPDATE logical_models SET credits_cost=$2, updated_at=now() WHERE id=$1`, logicalModelID, credits)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &generation.APIError{Code: "NOT_FOUND", Message: "模型不存在", Status: 404}
	}
	return nil
}

// CheckModel 在创建付费任务前拦截毛利低于阈值的模型。成本未核实时放行并在界面标注。
func (s *Service) CheckModel(ctx context.Context, logicalKey string) error {
	if strings.TrimSpace(logicalKey) == "" {
		return nil
	}
	st, err := s.Settings(ctx)
	if err != nil {
		return nil // 定价表不可用时不影响生成主链路
	}
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(lm.credits_cost,0), cm.cost_amount::float8, cm.cost_currency, cm.cost_unit, cm.cost_verified, COALESCE(cm.provider_model_id,'')
		FROM logical_models lm
		JOIN logical_model_abilities mr ON mr.logical_model_id = lm.id AND mr.enabled = true
		JOIN channel_models cm ON cm.id = mr.channel_model_id
		WHERE lm.key = $1`, logicalKey)
	if err != nil {
		return nil
	}
	defer rows.Close()
	for rows.Next() {
		var credits int64
		var amount float64
		var currency, unit, providerModel string
		var verified bool
		if err := rows.Scan(&credits, &amount, &currency, &unit, &verified, &providerModel); err != nil {
			return nil
		}
		_, _, _, marginRate, status, reason := evaluate(credits, amount, currency, unit, verified, st)
		if status == "block" {
			return &generation.APIError{
				Code:    "MODEL_MARGIN_BLOCKED",
				Message: fmt.Sprintf("%s 当前毛利率 %.1f%% 低于下限 %.0f%%（%s），已暂停该模型付费提交", providerModel, marginRate*100, st.MinMarginRate*100, reason),
				Status:  422,
			}
		}
	}
	return rows.Err()
}

func evaluate(credits int64, costAmount float64, currency, unit string, verified bool, st Settings) (sell, costCNY, margin, marginRate float64, status, reason string) {
	sell = float64(credits) * st.CreditCNYRate
	costCNY = costAmount
	if strings.EqualFold(currency, "USD") {
		costCNY = costAmount * st.FXUSDCNY
	}
	switch {
	case !verified || costAmount <= 0:
		return sell, costCNY, 0, 0, "unverified", "厂商成本待合同核实"
	case unit == "per_second":
		return sell, costCNY, 0, 0, "needs_duration", "按秒计价，需按生成时长换算后再比较"
	case sell <= 0:
		return sell, costCNY, 0, 0, "block", "售价为空"
	}
	margin = sell - costCNY
	marginRate = margin / sell
	if marginRate+1e-9 < st.MinMarginRate {
		return sell, costCNY, margin, marginRate, "block", fmt.Sprintf("低于最低毛利率 %.0f%%", st.MinMarginRate*100)
	}
	return sell, costCNY, margin, marginRate, "ok", ""
}
