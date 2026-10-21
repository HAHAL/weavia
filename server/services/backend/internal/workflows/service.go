package workflows

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Workflow struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Graph     json.RawMessage `json:"graph"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}
type Run struct {
	ID         string          `json:"id"`
	WorkflowID string          `json:"workflowId"`
	Status     string          `json:"status"`
	Graph      json.RawMessage `json:"graph,omitempty"`
	Result     json.RawMessage `json:"result,omitempty"`
	Error      string          `json:"error,omitempty"`
	StartedAt  time.Time       `json:"startedAt"`
	FinishedAt *time.Time      `json:"finishedAt,omitempty"`
}
type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

func (s *Service) List(ctx context.Context, userID string) ([]Workflow, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,name,graph,created_at,updated_at FROM workflows WHERE user_id=$1 ORDER BY updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Workflow{}
	for rows.Next() {
		var item Workflow
		if err = rows.Scan(&item.ID, &item.Name, &item.Graph, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) Save(ctx context.Context, userID, id, name string, graph json.RawMessage) (Workflow, error) {
	if len(graph) == 0 {
		graph = json.RawMessage(`{"nodes":[],"edges":[]}`)
	}
	var item Workflow
	if id == "" {
		err := s.pool.QueryRow(ctx, `INSERT INTO workflows(user_id,name,graph) VALUES($1,$2,$3) RETURNING id::text,name,graph,created_at,updated_at`, userID, name, graph).Scan(&item.ID, &item.Name, &item.Graph, &item.CreatedAt, &item.UpdatedAt)
		return item, err
	}
	err := s.pool.QueryRow(ctx, `UPDATE workflows SET name=$3,graph=$4,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id::text,name,graph,created_at,updated_at`, id, userID, name, graph).Scan(&item.ID, &item.Name, &item.Graph, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func (s *Service) Delete(ctx context.Context, userID, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM workflows WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}

func (s *Service) StartRun(ctx context.Context, userID, workflowID string, graph json.RawMessage) (Run, error) {
	var run Run
	err := s.pool.QueryRow(ctx, `INSERT INTO workflow_runs(workflow_id,user_id,status,graph) SELECT id,$2,'running',$3 FROM workflows WHERE id=$1 AND user_id=$2 RETURNING id::text,workflow_id::text,status,started_at`, workflowID, userID, graph).Scan(&run.ID, &run.WorkflowID, &run.Status, &run.StartedAt)
	return run, err
}

func (s *Service) FinishRun(ctx context.Context, userID, runID, status string, result json.RawMessage, message string) error {
	if status != "success" && status != "failed" && status != "cancelled" {
		status = "failed"
	}
	_, err := s.pool.Exec(ctx, `UPDATE workflow_runs SET status=$3,result=$4,error=$5,finished_at=now() WHERE id=$1 AND user_id=$2`, runID, userID, status, result, message)
	return err
}

func (s *Service) ListRuns(ctx context.Context, userID, workflowID string) ([]Run, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,workflow_id::text,status,result,coalesce(error,''),started_at,finished_at FROM workflow_runs WHERE user_id=$1 AND workflow_id=$2 ORDER BY started_at DESC LIMIT 50`, userID, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Run{}
	for rows.Next() {
		var item Run
		if err = rows.Scan(&item.ID, &item.WorkflowID, &item.Status, &item.Result, &item.Error, &item.StartedAt, &item.FinishedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
