package ops

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	Pool         *pgxpool.Pool
	SnapshotPath string
}

func New(pool *pgxpool.Pool, snapshotPath string) *Service {
	return &Service{Pool: pool, SnapshotPath: snapshotPath}
}

type Event struct {
	Stage      string    `json:"stage"`
	State      string    `json:"state"`
	Code       string    `json:"code"`
	DurationMS int64     `json:"durationMs"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (s *Service) Record(ctx context.Context, taskID, stage, state, code string, duration time.Duration) error {
	code = safeCode(code)
	_, err := s.Pool.Exec(ctx, `INSERT INTO task_events(task_id,stage,state,code,duration_ms)
		VALUES($1,$2,$3,$4,$5)`, taskID, stage, state, code, duration.Milliseconds())
	return err
}

func safeCode(value string) string {
	if len(value) > 64 {
		return "UNCLASSIFIED"
	}
	for _, char := range value {
		if !(char >= 'A' && char <= 'Z') && !(char >= '0' && char <= '9') && char != '_' {
			return "UNCLASSIFIED"
		}
	}
	return value
}

func (s *Service) StartRun(ctx context.Context, taskID string) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO task_runs(task_id,attempt,status,started_at)
		VALUES($1,1,'running',now()) ON CONFLICT(task_id,attempt) DO UPDATE
		SET status='running',started_at=coalesce(task_runs.started_at,excluded.started_at),updated_at=now()`, taskID)
	return err
}

func (s *Service) FinishRun(ctx context.Context, taskID, status string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE task_runs SET status=$2::task_status,finished_at=now(),updated_at=now()
		WHERE task_id=$1 AND attempt=1`, taskID, status)
	return err
}

func (s *Service) Heartbeat(ctx context.Context) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO worker_heartbeats(worker_name,last_seen_at)
		VALUES('generation',now()) ON CONFLICT(worker_name) DO UPDATE SET last_seen_at=excluded.last_seen_at`)
	return err
}

func (s *Service) Cleanup(ctx context.Context) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM task_events WHERE created_at < now()-interval '90 days'`)
	return err
}

func (s *Service) Events(ctx context.Context, taskID string) ([]Event, error) {
	rows, err := s.Pool.Query(ctx, `SELECT stage,state,code,duration_ms,created_at
		FROM task_events WHERE task_id::text=$1 ORDER BY created_at,id LIMIT 200`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.Stage, &e.State, &e.Code, &e.DurationMS, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

type Container struct {
	Name        string  `json:"name"`
	State       string  `json:"state"`
	Health      string  `json:"health"`
	Restarts    int     `json:"restarts"`
	CPUPercent  float64 `json:"cpuPercent"`
	MemoryBytes int64   `json:"memoryBytes"`
}
type HostSnapshot struct {
	CapturedAt  time.Time             `json:"capturedAt"`
	CPUPercent  float64               `json:"cpuPercent"`
	MemoryTotal int64                 `json:"memoryTotal"`
	MemoryUsed  int64                 `json:"memoryUsed"`
	DiskTotal   int64                 `json:"diskTotal"`
	DiskUsed    int64                 `json:"diskUsed"`
	Containers  []Container           `json:"containers"`
	Logs        map[string][]LogEntry `json:"logs"`
}
type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

func (s *Service) Host() (*HostSnapshot, error) {
	if s.SnapshotPath == "" {
		return nil, nil
	}
	data, err := os.ReadFile(filepath.Clean(s.SnapshotPath))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(data) > 1024*1024 {
		return nil, errors.New("ops snapshot exceeds limit")
	}
	var snapshot HostSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, err
	}
	return &snapshot, nil
}

type HostMetric struct {
	CapturedAt  time.Time `json:"capturedAt"`
	CPUPercent  float64   `json:"cpuPercent"`
	MemoryTotal int64     `json:"memoryTotal"`
	MemoryUsed  int64     `json:"memoryUsed"`
	DiskTotal   int64     `json:"diskTotal"`
	DiskUsed    int64     `json:"diskUsed"`
}

func (s *Service) History(period string) ([]HostMetric, error) {
	out := []HostMetric{}
	if s.SnapshotPath == "" {
		return out, nil
	}
	name, maxAge := "metrics.ndjson", 7*24*time.Hour
	if period == "24h" {
		maxAge = 24 * time.Hour
	}
	if period == "30d" {
		name, maxAge = "metrics-hourly.ndjson", 30*24*time.Hour
	}
	file, err := os.Open(filepath.Join(filepath.Dir(s.SnapshotPath), name))
	if errors.Is(err, os.ErrNotExist) {
		return out, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var item HostMetric
		if json.Unmarshal(scanner.Bytes(), &item) == nil && time.Since(item.CapturedAt) < maxAge {
			out = append(out, item)
			if len(out) > 2100 {
				out = out[len(out)-2100:]
			}
		}
	}
	return out, scanner.Err()
}

type QueueStatus struct {
	Waiting           int64      `json:"waiting"`
	Running           int64      `json:"running"`
	OldestWaitSeconds int64      `json:"oldestWaitSeconds"`
	Failed24h         int64      `json:"failed24h"`
	WorkerLastSeen    *time.Time `json:"workerLastSeen"`
}

func (s *Service) Queue(ctx context.Context) (QueueStatus, error) {
	var q QueueStatus
	err := s.Pool.QueryRow(ctx, `SELECT
		count(*) FILTER (WHERE state IN ('available','scheduled','retryable')),
		count(*) FILTER (WHERE state='running'),
		coalesce(extract(epoch FROM now()-min(created_at) FILTER (WHERE state='available')),0)::bigint
		FROM river_job WHERE queue='ai_generation'`).Scan(&q.Waiting, &q.Running, &q.OldestWaitSeconds)
	if err != nil {
		return q, err
	}
	if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM tasks WHERE status='failed' AND updated_at>now()-interval '24 hours'`).Scan(&q.Failed24h); err != nil {
		return q, err
	}
	var heartbeat time.Time
	err = s.Pool.QueryRow(ctx, `SELECT last_seen_at FROM worker_heartbeats WHERE worker_name='generation'`).Scan(&heartbeat)
	if err == nil {
		q.WorkerLastSeen = &heartbeat
	}
	return q, nil
}

type ChannelStatus struct {
	Name     string `json:"name"`
	Calls    int64  `json:"calls"`
	Failures int64  `json:"failures"`
}

func (s *Service) Channels(ctx context.Context) ([]ChannelStatus, error) {
	rows, err := s.Pool.Query(ctx, `SELECT pc.name,count(l.id),count(l.id) FILTER (WHERE l.status='failed')
		FROM provider_channels pc LEFT JOIN model_route_logs l ON l.channel_id=pc.id AND l.created_at>now()-interval '24 hours'
		WHERE pc.enabled=true GROUP BY pc.id,pc.name ORDER BY pc.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ChannelStatus{}
	for rows.Next() {
		var c ChannelStatus
		if err := rows.Scan(&c.Name, &c.Calls, &c.Failures); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
