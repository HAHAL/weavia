package generation

import (
	"context"
	"sync"
)

type MemoryRepository struct {
	mu    sync.RWMutex
	tasks map[string]Task
	idem  map[string]string
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{tasks: map[string]Task{}, idem: map[string]string{}}
}
func (r *MemoryRepository) Create(_ context.Context, t Task) (Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := t.UserID + ":" + t.IdempotencyKey
	if existing := r.idem[key]; existing != "" {
		return r.tasks[existing], nil
	}
	r.tasks[t.ID] = t
	r.idem[key] = t.ID
	return t, nil
}
func (r *MemoryRepository) Get(_ context.Context, id string) (Task, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tasks[id]
	return t, ok, nil
}
func (r *MemoryRepository) List(_ context.Context, userID string) ([]Task, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := []Task{}
	for _, t := range r.tasks {
		if t.UserID == userID {
			out = append(out, t)
		}
	}
	return out, nil
}
func (r *MemoryRepository) Update(_ context.Context, t Task) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tasks[t.ID] = t
	return nil
}
