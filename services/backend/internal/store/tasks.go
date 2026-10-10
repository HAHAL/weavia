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
	return r.queries.EnsureDemoUser(ctx)
}

func (r *TaskRepository) Create(ctx context.Context, task generation.Task) (generation.Task, error) {
	input, _ := json.Marshal(task.Request)
	created, _ := time.Parse(time.RFC3339Nano, task.CreatedAt)
	kind := db.TaskType(task.Workflow)
	if kind != "ai_model" && kind != "ai_commercial" && kind != "product_image_generation" {
		kind = "image_generation"
	}
	row, err := r.queries.CreateTask(ctx, db.CreateTaskParams{ID: task.ID, UserID: task.UserID, Column3: kind, IdempotencyKey: task.IdempotencyKey, Input: input, CreatedAt: pgtype.Timestamptz{Time: created, Valid: true}})
	if err != nil {
		return generation.Task{}, err
	}
	_, err = r.pool.Exec(ctx, `UPDATE tasks SET status='reserved',workspace_id=nullif($2,'')::uuid,product_id=nullif($3,'')::uuid,sku_id=nullif($4,'')::uuid,credit_reservation_id=nullif($5,'')::uuid,provider=$6,model=$7,cost=$8,reserved_credits=$8 WHERE id=$1`, row.ID, task.WorkspaceID, task.ProductID, task.SKUID, task.CreditReservationID, task.Provider, task.Model, task.Cost)
	if err != nil {
		return generation.Task{}, err
	}
	row.Status = "reserved"
	return decodeRow(row.ID, row.UserID, row.Status, row.IdempotencyKey, row.Input, row.Output, row.Error, row.CreatedAt, row.UpdatedAt)
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
func (r *TaskRepository) Update(ctx context.Context, task generation.Task) error {
	status := db.TaskStatus(task.Status)
	if status == "generated" {
		status = "success"
	}
	output, _ := json.Marshal(struct {
		Outputs           []generation.Output `json:"outputs"`
		ProviderRequestID string              `json:"providerRequestId,omitempty"`
	}{task.Outputs, task.ProviderRequestID})
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
	task.Provider = providerForModel(request.Model)
	task.Cost = int64(10 * request.NumberOfImages)
	var envelope struct {
		Outputs           []generation.Output `json:"outputs"`
		ProviderRequestID string              `json:"providerRequestId"`
	}
	if len(output) > 0 {
		_ = json.Unmarshal(output, &envelope)
		task.Outputs = envelope.Outputs
		task.ProviderRequestID = envelope.ProviderRequestID
	}
	if len(errorJSON) > 0 {
		task.Error = &generation.TaskError{}
		_ = json.Unmarshal(errorJSON, task.Error)
	}
	return task, nil
}
func providerForModel(model string) string {
	if model == "qwen-image-2.0" {
		return "dashscope"
	}
	return "antdigital"
}
