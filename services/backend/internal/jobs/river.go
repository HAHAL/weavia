package jobs

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

const Queue = "ai_generation"

type GenerationArgs struct {
	TaskID string `json:"task_id"`
}

func (GenerationArgs) Kind() string { return "generation" }

type Worker struct {
	river.WorkerDefaults[GenerationArgs]
	Service *generation.Service
}

func (w *Worker) Work(ctx context.Context, job *river.Job[GenerationArgs]) error {
	return w.Service.Execute(ctx, job.Args.TaskID)
}
func (w *Worker) Timeout(*river.Job[GenerationArgs]) time.Duration { return 3 * time.Minute }

type Enqueuer struct{ Client *river.Client[pgx.Tx] }

func (e Enqueuer) Enqueue(ctx context.Context, taskID string) error {
	_, err := e.Client.Insert(ctx, GenerationArgs{TaskID: taskID}, &river.InsertOpts{Queue: Queue, MaxAttempts: 3})
	return err
}
func Workers(service *generation.Service) *river.Workers {
	workers := river.NewWorkers()
	river.AddWorker(workers, &Worker{Service: service})
	return workers
}
