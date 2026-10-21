package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/store/db"
)

type TaskRepository struct {
	queries *db.Queries
	pool    *pgxpool.Pool
}

func NewTaskRepository(pool *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{queries: db.New(pool), pool: pool}
}
func (r *TaskRepository) EnsureDemoUser(ctx context.Context) error {
	if err := r.queries.EnsureDemoUser(ctx); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `INSERT INTO subscriptions(user_id,plan_id,status,current_period_start) SELECT '00000000-0000-4000-8000-000000000001',id,'active',now() FROM plans WHERE code='free' AND NOT EXISTS(SELECT 1 FROM subscriptions WHERE user_id='00000000-0000-4000-8000-000000000001' AND status IN('active','trialing')); INSERT INTO credit_accounts(user_id,available_balance) VALUES('00000000-0000-4000-8000-000000000001',50) ON CONFLICT(user_id,currency) DO NOTHING`)
	return err
}

func (r *TaskRepository) Create(ctx context.Context, task generation.Task) (generation.Task, error) {
	input, _ := json.Marshal(task.Request)
	created, _ := time.Parse(time.RFC3339Nano, task.CreatedAt)
	kind := db.TaskType(task.Workflow)
	if kind != "ai_model" && kind != "ai_commercial" && kind != "product_image_generation" {
		kind = "image_generation"
	}
	var row struct {
		id, userID, status, idem string
		input, output, errorJSON []byte
		created, updated         time.Time
	}
	err := r.pool.QueryRow(ctx, `INSERT INTO tasks(id,user_id,type,status,idempotency_key,input,pricing_snapshot,reserved_credits,consumed_credits,created_at,updated_at,workspace_id,product_id,sku_id,credit_reservation_id,provider,model,cost)
	VALUES($1,$2,$3::task_type,'reserved',$4,$5,'{}'::jsonb,$6,0,$7,$7,nullif($8,'')::uuid,nullif($9,'')::uuid,nullif($10,'')::uuid,nullif($11,'')::uuid,$12,$13,$6)
	ON CONFLICT(user_id,idempotency_key) DO UPDATE SET updated_at=tasks.updated_at
	RETURNING id::text,user_id::text,status::text,idempotency_key,input,output,error,created_at,updated_at`, task.ID, task.UserID, kind, task.IdempotencyKey, input, task.Cost, created, task.WorkspaceID, task.ProductID, task.SKUID, task.CreditReservationID, task.Provider, task.Model).Scan(&row.id, &row.userID, &row.status, &row.idem, &row.input, &row.output, &row.errorJSON, &row.created, &row.updated)
	if err != nil {
		return generation.Task{}, err
	}
	return decodeRow(row.id, row.userID, row.status, row.idem, row.input, row.output, row.errorJSON, pgtype.Timestamptz{Time: row.created, Valid: true}, pgtype.Timestamptz{Time: row.updated, Valid: true})
}
func (r *TaskRepository) Get(ctx context.Context, id string) (generation.Task, bool, error) {
	row, err := r.queries.GetTask(ctx, id)
	if err == pgx.ErrNoRows {
		return generation.Task{}, false, nil
	}
	if err != nil {
		return generation.Task{}, false, err
	}
	task, err := decodeRow(row.ID, row.UserID, row.Status, row.IdempotencyKey, row.Input, row.Output, row.Error, row.CreatedAt, row.UpdatedAt)
	if err == nil && task.Provider == "" {
		err = r.pool.QueryRow(ctx, `SELECT p.code,m.credit_cost FROM ai_models m JOIN ai_providers p ON p.id=m.provider_id WHERE m.model_name=$1`, task.Model).Scan(&task.Provider, &task.Cost)
		task.Request.ResolvedProvider = task.Provider
		task.Request.ResolvedCost = task.Cost
	}
	return task, true, err
}
func (r *TaskRepository) List(ctx context.Context, userID string) ([]generation.Task, error) {
	rows, err := r.queries.ListTasks(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]generation.Task, 0, len(rows))
	for _, row := range rows {
		task, decodeErr := decodeRow(row.ID, row.UserID, row.Status, row.IdempotencyKey, row.Input, row.Output, row.Error, row.CreatedAt, row.UpdatedAt)
		if decodeErr != nil {
			return nil, decodeErr
		}
		result = append(result, task)
	}
	return result, nil
}
func (r *TaskRepository) ListRunningVideo(ctx context.Context) ([]generation.Task, error) {
	rows, err := r.pool.Query(ctx, `SELECT id::text,user_id::text,status::text,idempotency_key,input,output,error,created_at,updated_at FROM tasks WHERE status IN ('reserved','running') AND input->>'mode' LIKE '%video%' ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []generation.Task{}
	for rows.Next() {
		var id, userID, status, idem string
		var input, output, errorJSON []byte
		var created, updated pgtype.Timestamptz
		if err = rows.Scan(&id, &userID, &status, &idem, &input, &output, &errorJSON, &created, &updated); err != nil {
			return nil, err
		}
		task, err := decodeRow(id, userID, status, idem, input, output, errorJSON, created, updated)
		if err != nil {
			return nil, err
		}
		items = append(items, task)
	}
	return items, rows.Err()
}

func (r *TaskRepository) Update(ctx context.Context, task generation.Task) error {
	status := db.TaskStatus(task.Status)
	if status == "generated" {
		status = "success"
	}
	output, _ := json.Marshal(struct {
		Outputs           []generation.Output `json:"outputs"`
		ProviderRequestID string              `json:"providerRequestId,omitempty"`
		ProviderTaskID    string              `json:"providerTaskId,omitempty"`
	}{task.Outputs, task.ProviderRequestID, task.ProviderTaskID})
	var errorJSON []byte
	if task.Error != nil {
		errorJSON, _ = json.Marshal(task.Error)
	}
	updated, _ := time.Parse(time.RFC3339Nano, task.UpdatedAt)
	return r.queries.UpdateTask(ctx, db.UpdateTaskParams{ID: task.ID, Column2: status, Output: output, Error: errorJSON, UpdatedAt: pgtype.Timestamptz{Time: updated, Valid: true}})
}

func decodeRow(id, userID, status, idem string, input, output, errorJSON []byte, created, updated pgtype.Timestamptz) (generation.Task, error) {
	var request generation.Request
	if err := json.Unmarshal(input, &request); err != nil {
		return generation.Task{}, err
	}
	task := generation.Task{ID: id, UserID: userID, IdempotencyKey: idem, Workflow: request.Workflow, LogicalModel: request.LogicalModel, Status: status, Outputs: []generation.Output{}, CreatedAt: created.Time.UTC().Format(time.RFC3339Nano), UpdatedAt: updated.Time.UTC().Format(time.RFC3339Nano), Request: request}
	task.WorkspaceID = request.WorkspaceID
	task.ProductID = request.ProductID
	task.SKUID = request.SKUID
	task.CreditReservationID = request.CreditReservationID
	task.Model = request.Model
	task.Prompt = request.Prompt
	task.Mode = request.Mode
	task.Ratio = request.Ratio
	task.Resolution = request.Resolution
	task.Count = request.NumberOfImages
	task.Provider = request.ResolvedProvider
	task.Cost = request.ResolvedCost
	var envelope struct {
		Outputs           []generation.Output `json:"outputs"`
		ProviderRequestID string              `json:"providerRequestId"`
		ProviderTaskID    string              `json:"providerTaskId"`
	}
	if len(output) > 0 {
		_ = json.Unmarshal(output, &envelope)
		task.Outputs = envelope.Outputs
		task.ProviderRequestID = envelope.ProviderRequestID
		task.ProviderTaskID = envelope.ProviderTaskID
	}
	if len(errorJSON) > 0 {
		task.Error = &generation.TaskError{}
		_ = json.Unmarshal(errorJSON, task.Error)
	}
	return task, nil
}
