package commercial

import (
	"context"
	"time"
)

type AdminMetrics struct {
	Users            int64              `json:"users"`
	NewUsersToday    int64              `json:"newUsersToday"`
	PaidMembers      int64              `json:"paidMembers"`
	RevenueMinorCNY  int64              `json:"revenueMinorCNY"`
	CreditsConsumed  int64              `json:"creditsConsumed"`
	AICostByCurrency map[string]float64 `json:"aiCostByCurrency"`
	GrossProfitCNY   *float64           `json:"grossProfitCNY"`
	Tasks            int64              `json:"tasks"`
	FailedTasks      int64              `json:"failedTasks"`
}

func (s *Service) AdminOverview(ctx context.Context) (AdminMetrics, error) {
	var metrics AdminMetrics
	err := s.pool.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM users),
		(SELECT count(*) FROM users WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai')),
		(SELECT count(DISTINCT s.user_id) FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.status IN ('active','trialing') AND p.price_minor > 0),
		(SELECT coalesce(sum(amount_minor),0) FROM orders WHERE status='paid' AND currency='CNY'),
		(SELECT coalesce(-sum(available_delta+reserved_delta),0) FROM credit_transactions_v1 WHERE type='consume'),
		(SELECT count(*) FROM tasks),
		(SELECT count(*) FROM tasks WHERE status='failed')`).Scan(
		&metrics.Users, &metrics.NewUsersToday, &metrics.PaidMembers, &metrics.RevenueMinorCNY,
		&metrics.CreditsConsumed, &metrics.Tasks, &metrics.FailedTasks,
	)
	if err != nil {
		return metrics, err
	}
	rows, err := s.pool.Query(ctx, `SELECT coalesce(pm.currency,'UNKNOWN'),sum(coalesce(pu.actual_cost,pu.estimated_cost,0))::double precision FROM provider_usage pu LEFT JOIN provider_models pm ON pm.id=pu.provider_model_id GROUP BY coalesce(pm.currency,'UNKNOWN')`)
	if err != nil {
		return metrics, err
	}
	defer rows.Close()
	metrics.AICostByCurrency = map[string]float64{}
	comparable := true
	for rows.Next() {
		var currency string
		var amount float64
		if err := rows.Scan(&currency, &amount); err != nil {
			return metrics, err
		}
		metrics.AICostByCurrency[currency] = amount
		if currency != "CNY" && amount != 0 {
			comparable = false
		}
	}
	if err := rows.Err(); err != nil {
		return metrics, err
	}
	if comparable {
		profit := float64(metrics.RevenueMinorCNY)/100 - metrics.AICostByCurrency["CNY"]
		metrics.GrossProfitCNY = &profit
	}
	return metrics, nil
}

type AdminOrder struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Email       string    `json:"email"`
	Status      string    `json:"status"`
	Kind        string    `json:"kind"`
	AmountMinor int       `json:"amountMinor"`
	Currency    string    `json:"currency"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AdminPlan struct {
	ID              string `json:"id"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	BillingCycle    string `json:"billingCycle"`
	PriceMinor      int    `json:"priceMinor"`
	IncludedCredits int64  `json:"includedCredits"`
	MaxDevices      int    `json:"maxDevices"`
	MaxConcurrency  int    `json:"maxConcurrency"`
	Enabled         bool   `json:"enabled"`
}

func (s *Service) AdminPlans(ctx context.Context) ([]AdminPlan, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,code,name,billing_cycle,price_minor,included_credits,max_devices,max_concurrency,enabled FROM plans ORDER BY price_minor`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminPlan{}
	for rows.Next() {
		var plan AdminPlan
		if err := rows.Scan(&plan.ID, &plan.Code, &plan.Name, &plan.BillingCycle, &plan.PriceMinor, &plan.IncludedCredits, &plan.MaxDevices, &plan.MaxConcurrency, &plan.Enabled); err != nil {
			return nil, err
		}
		out = append(out, plan)
	}
	return out, rows.Err()
}

func (s *Service) AdminOrders(ctx context.Context) ([]AdminOrder, error) {
	rows, err := s.pool.Query(ctx, `SELECT o.id::text,o.user_id::text,coalesce(u.email,''),o.status::text,o.kind,o.amount_minor,o.currency,o.created_at FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminOrder{}
	for rows.Next() {
		var order AdminOrder
		if err := rows.Scan(&order.ID, &order.UserID, &order.Email, &order.Status, &order.Kind, &order.AmountMinor, &order.Currency, &order.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, order)
	}
	return out, rows.Err()
}

type AdminPayment struct {
	ID          string     `json:"id"`
	OrderID     string     `json:"orderId"`
	Provider    string     `json:"provider"`
	Status      string     `json:"status"`
	AmountMinor int        `json:"amountMinor"`
	Currency    string     `json:"currency"`
	PaidAt      *time.Time `json:"paidAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

func (s *Service) AdminPayments(ctx context.Context) ([]AdminPayment, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,order_id::text,provider,status,amount_minor,currency,paid_at,created_at FROM payments ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminPayment{}
	for rows.Next() {
		var payment AdminPayment
		if err := rows.Scan(&payment.ID, &payment.OrderID, &payment.Provider, &payment.Status, &payment.AmountMinor, &payment.Currency, &payment.PaidAt, &payment.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, payment)
	}
	return out, rows.Err()
}

type AdminDevice struct {
	ID           string     `json:"id"`
	UserID       string     `json:"userId"`
	Name         string     `json:"name"`
	Platform     string     `json:"platform"`
	LastActiveAt *time.Time `json:"lastActiveAt"`
	RevokedAt    *time.Time `json:"revokedAt"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type AdminUsageRecord struct {
	ID              string    `json:"id"`
	ProviderID      string    `json:"providerId"`
	ProviderModelID string    `json:"providerModelId"`
	Workflow        string    `json:"workflow"`
	Status          string    `json:"status"`
	EstimatedCost   float64   `json:"estimatedCost"`
	LatencyMs       int       `json:"latencyMs"`
	CreatedAt       time.Time `json:"createdAt"`
}

type AdminTaskRun struct {
	ID         string     `json:"id"`
	TaskID     string     `json:"taskId"`
	Attempt    int        `json:"attempt"`
	Status     string     `json:"status"`
	StartedAt  *time.Time `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
	CreatedAt  time.Time  `json:"createdAt"`
}

func (s *Service) AdminTaskRuns(ctx context.Context) ([]AdminTaskRun, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,task_id::text,attempt,status::text,started_at,finished_at,created_at FROM task_runs ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminTaskRun{}
	for rows.Next() {
		var run AdminTaskRun
		if err := rows.Scan(&run.ID, &run.TaskID, &run.Attempt, &run.Status, &run.StartedAt, &run.FinishedAt, &run.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, run)
	}
	return out, rows.Err()
}

func (s *Service) AdminUsage(ctx context.Context) ([]AdminUsageRecord, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,provider_id::text,provider_model_id::text,workflow,status,coalesce(actual_cost,estimated_cost,0)::double precision,latency_ms,created_at FROM provider_usage ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminUsageRecord{}
	for rows.Next() {
		var record AdminUsageRecord
		if err := rows.Scan(&record.ID, &record.ProviderID, &record.ProviderModelID, &record.Workflow, &record.Status, &record.EstimatedCost, &record.LatencyMs, &record.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, record)
	}
	return out, rows.Err()
}

func (s *Service) AdminDevices(ctx context.Context) ([]AdminDevice, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,user_id::text,name,platform,last_active_at,revoked_at,created_at FROM devices ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminDevice{}
	for rows.Next() {
		var device AdminDevice
		if err := rows.Scan(&device.ID, &device.UserID, &device.Name, &device.Platform, &device.LastActiveAt, &device.RevokedAt, &device.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, device)
	}
	return out, rows.Err()
}
