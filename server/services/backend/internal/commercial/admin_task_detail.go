package commercial

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

// AdminTask keeps the original cost for older clients, but exposes the actual
// reservation, consumption and release as separate amounts.
type AdminTask struct {
	ID                  string    `json:"id"`
	UserID              string    `json:"userId"`
	Email               string    `json:"email"`
	AccountNo           string    `json:"accountNo"`
	Type                string    `json:"type"`
	Status              string    `json:"status"`
	Provider            string    `json:"provider"`
	Model               string    `json:"model"`
	Cost                int64     `json:"cost"`
	ReservedCredits     int64     `json:"reservedCredits"`
	ConsumedCredits     int64     `json:"consumedCredits"`
	ReleasedCredits     int64     `json:"releasedCredits"`
	CreditReservationID string    `json:"creditReservationId"`
	BillingBasis        string    `json:"billingBasis"`
	ErrorCode           string    `json:"errorCode"`
	ErrorMessage        string    `json:"errorMessage"`
	Duration            string    `json:"duration"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

type AdminTaskRoute struct {
	ChannelName     string    `json:"channelName"`
	Provider        string    `json:"provider"`
	ProviderModelID string    `json:"providerModelId"`
	KeyLast4        string    `json:"keyLast4"`
	Attempt         int       `json:"attempt"`
	Status          string    `json:"status"`
	ErrorCode       string    `json:"errorCode"`
	LatencyMS       int       `json:"latencyMs"`
	CreatedAt       time.Time `json:"createdAt"`
}

type AdminTaskTransaction struct {
	Type           string    `json:"type"`
	AvailableDelta int64     `json:"availableDelta"`
	ReservedDelta  int64     `json:"reservedDelta"`
	CreatedAt      time.Time `json:"createdAt"`
}

type AdminTaskDetails struct {
	Task         AdminTask              `json:"task"`
	Routes       []AdminTaskRoute       `json:"routes"`
	Transactions []AdminTaskTransaction `json:"transactions"`
}

const adminTaskSelect = `SELECT t.id::text,t.user_id::text,coalesce(u.email,''),coalesce(u.account_no,''),
	t.type::text,t.status::text,coalesce(t.provider,''),coalesce(t.model,''),t.cost,
	t.reserved_credits,
	CASE WHEN t.credit_reservation_id IS NULL THEN t.consumed_credits ELSE
		coalesce((SELECT -sum(ct.reserved_delta) FROM credit_transactions_v1 ct WHERE ct.reservation_id=t.credit_reservation_id AND ct.type='consume'),0)::bigint END,
	coalesce((SELECT sum(ct.available_delta) FROM credit_transactions_v1 ct WHERE ct.reservation_id=t.credit_reservation_id AND ct.type='release'),0)::bigint,
	coalesce(t.credit_reservation_id::text,''),coalesce(t.pricing_snapshot->>'billingBasis',''),
	coalesce(t.error->>'code',''),coalesce(t.error->>'message',''),coalesce(t.input->>'duration',''),
	t.created_at,t.updated_at
	FROM tasks t LEFT JOIN users u ON u.id=t.user_id`

func scanAdminTask(row pgx.Row) (AdminTask, error) {
	var task AdminTask
	err := row.Scan(&task.ID, &task.UserID, &task.Email, &task.AccountNo,
		&task.Type, &task.Status, &task.Provider, &task.Model, &task.Cost,
		&task.ReservedCredits, &task.ConsumedCredits, &task.ReleasedCredits,
		&task.CreditReservationID, &task.BillingBasis, &task.ErrorCode, &task.ErrorMessage,
		&task.Duration, &task.CreatedAt, &task.UpdatedAt)
	return task, err
}

func (s *Service) AdminTaskDetail(ctx context.Context, taskID string) (AdminTaskDetails, error) {
	task, err := scanAdminTask(s.pool.QueryRow(ctx, adminTaskSelect+` WHERE t.id::text=$1`, taskID))
	if errors.Is(err, pgx.ErrNoRows) {
		return AdminTaskDetails{}, &generation.APIError{Code: "NOT_FOUND", Message: "任务不存在", Status: 404}
	}
	if err != nil {
		return AdminTaskDetails{}, err
	}
	detail := AdminTaskDetails{Task: task, Routes: []AdminTaskRoute{}, Transactions: []AdminTaskTransaction{}}
	routes, err := s.pool.Query(ctx, `SELECT coalesce(pc.name,''),coalesce(pc.provider_code,''),coalesce(l.provider_model_id,''),
		coalesce(k.key_last4,''),l.attempt,l.status,coalesce(l.error_code,''),l.latency_ms,l.created_at
		FROM model_route_logs l LEFT JOIN provider_channels pc ON pc.id=l.channel_id
		LEFT JOIN channel_keys k ON k.id=l.key_id
		WHERE l.task_id::text=$1 ORDER BY l.created_at DESC LIMIT 5`, taskID)
	if err != nil {
		return AdminTaskDetails{}, err
	}
	for routes.Next() {
		var route AdminTaskRoute
		if err = routes.Scan(&route.ChannelName, &route.Provider, &route.ProviderModelID,
			&route.KeyLast4, &route.Attempt, &route.Status, &route.ErrorCode,
			&route.LatencyMS, &route.CreatedAt); err != nil {
			routes.Close()
			return AdminTaskDetails{}, err
		}
		detail.Routes = append(detail.Routes, route)
	}
	err = routes.Err()
	routes.Close()
	if err != nil {
		return AdminTaskDetails{}, err
	}
	if task.CreditReservationID == "" {
		return detail, nil
	}
	transactions, err := s.pool.Query(ctx, `SELECT type::text,available_delta,reserved_delta,created_at
		FROM credit_transactions_v1 WHERE reservation_id::text=$1 ORDER BY created_at`, task.CreditReservationID)
	if err != nil {
		return AdminTaskDetails{}, err
	}
	for transactions.Next() {
		var transaction AdminTaskTransaction
		if err = transactions.Scan(&transaction.Type, &transaction.AvailableDelta,
			&transaction.ReservedDelta, &transaction.CreatedAt); err != nil {
			transactions.Close()
			return AdminTaskDetails{}, err
		}
		detail.Transactions = append(detail.Transactions, transaction)
	}
	err = transactions.Err()
	transactions.Close()
	return detail, err
}
