package generation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/providers"
)

type Request struct {
	IdempotencyKey      string           `json:"idempotencyKey"`
	WorkspaceID         string           `json:"workspaceId"`
	ProjectID           string           `json:"projectId"`
	ProductID           string           `json:"productId"`
	SKUID               string           `json:"skuId"`
	CreditReservationID string           `json:"creditReservationId,omitempty"`
	InputAssetID        string           `json:"inputAssetId"`
	Workflow            string           `json:"workflow"`
	LogicalModel        string           `json:"logicalModel"`
	Model               string           `json:"model"`
	Prompt              string           `json:"prompt"`
	Mode                string           `json:"mode"`
	ReferenceAssets     []ReferenceAsset `json:"referenceAssets"`
	Size                string           `json:"size"`
	Quality             string           `json:"quality"`
	NumberOfImages      int              `json:"numberOfImages"`
	OutputFormat        string           `json:"outputFormat"`
	Metadata            map[string]any   `json:"metadata"`
	ResolvedProvider    string           `json:"resolvedProvider,omitempty"`
	ResolvedCost        int64            `json:"resolvedCost,omitempty"`
}
type ReferenceAsset struct {
	AssetID   string `json:"assetId"`
	ObjectKey string `json:"objectKey"`
	MimeType  string `json:"mimeType"`
}
type Output struct {
	TemporaryURL string `json:"temporaryUrl,omitempty"`
	Base64Data   string `json:"base64Data,omitempty"`
	ObjectKey    string `json:"objectKey,omitempty"`
	Size         int64  `json:"size,omitempty"`
	MimeType     string `json:"mimeType"`
}
type GeneratedStorage interface {
	SaveGenerated(context.Context, string, int, string, string) (string, int64, error)
	VerifyGenerated(string, []byte) error
	GeneratedDataURL(string, string) (string, error)
}
type Task struct {
	ID                  string     `json:"id"`
	UserID              string     `json:"userId"`
	IdempotencyKey      string     `json:"idempotencyKey"`
	Workflow            string     `json:"workflow"`
	LogicalModel        string     `json:"logicalModel"`
	WorkspaceID         string     `json:"workspaceId"`
	ProductID           string     `json:"productId"`
	SKUID               string     `json:"skuId"`
	CreditReservationID string     `json:"creditReservationId"`
	Provider            string     `json:"provider"`
	Model               string     `json:"model"`
	Cost                int64      `json:"cost"`
	Status              string     `json:"status"`
	Outputs             []Output   `json:"outputs"`
	ProviderRequestID   string     `json:"providerRequestId,omitempty"`
	Error               *TaskError `json:"error,omitempty"`
	CreatedAt           string     `json:"createdAt"`
	UpdatedAt           string     `json:"updatedAt"`
	Request             Request    `json:"-"`
}
type TaskError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
type Enqueuer interface {
	Enqueue(context.Context, string) error
}
type Generator interface {
	Generate(context.Context, providers.ImageRequest) (providers.ImageResult, error)
}
type Repository interface {
	Create(context.Context, Task) (Task, error)
	Get(context.Context, string) (Task, bool, error)
	List(context.Context, string) ([]Task, error)
	Update(context.Context, Task) error
}
type Credits interface {
	Reserve(context.Context, string, string, string, int64) (string, error)
	Confirm(context.Context, string) error
	Release(context.Context, string) error
	RecordGeneratedAsset(context.Context, string, string, string, string, string, string, string, string, int64) error
}

type Service struct {
	repository  Repository
	enqueue     Enqueuer
	provider    Generator
	realEnabled bool
	refs        func(string) (string, bool)
	credits     Credits
	registry    Registry
	storage     GeneratedStorage
}

func NewService(realEnabled bool, provider Generator, enqueue Enqueuer, refs func(string) (string, bool), repository Repository) *Service {
	if repository == nil {
		repository = NewMemoryRepository()
	}
	return &Service{repository: repository, realEnabled: realEnabled, provider: provider, enqueue: enqueue, refs: refs, registry: DefaultTestRegistry()}
}
func (s *Service) WithCredits(credits Credits) *Service          { s.credits = credits; return s }
func (s *Service) WithRegistry(registry Registry) *Service       { s.registry = registry; return s }
func (s *Service) WithStorage(storage GeneratedStorage) *Service { s.storage = storage; return s }

func (s *Service) Estimate(ctx context.Context, user auth.User, modelName string, count int, advanced bool) (map[string]any, error) {
	if count != 1 {
		return nil, &APIError{"INVALID_REQUEST", "Beta 当前仅支持单张生成", 400}
	}
	model, err := s.registry.Lookup(ctx, modelName)
	if err != nil || !model.Enabled || model.CreditCost <= 0 {
		return nil, &APIError{"UNSUPPORTED_MODEL", "模型不可用", 400}
	}
	if advanced && user.Email != "demo@weavia.local" {
		return nil, &APIError{"UNSUPPORTED_MODEL", "当前账户未开放高级模型", 403}
	}
	seconds := 60
	if configured, ok := model.Metadata["estimatedSeconds"].(float64); ok && configured > 0 {
		seconds = int(configured)
	}
	return map[string]any{"credits": model.CreditCost, "estimatedTime": seconds, "model": modelName}, nil
}

func (s *Service) Create(ctx context.Context, user auth.User, input Request) (Task, error) {
	if err := validateBase(input); err != nil {
		return Task{}, err
	}
	model, err := s.registry.Lookup(ctx, input.Model)
	if err != nil || !model.Enabled || model.Provider == "" || model.CreditCost <= 0 {
		return Task{}, &APIError{"UNSUPPORTED_MODEL", "模型不可用", 400}
	}
	if !supports(model.Capabilities, input.Mode) {
		return Task{}, &APIError{"UNSUPPORTED_CAPABILITY", "当前模型不支持所选生成方式", 400}
	}
	if max, ok := model.Metadata["maxReferences"].(float64); ok && len(input.ReferenceAssets) > int(max) {
		return Task{}, &APIError{"INVALID_REQUEST", "参考图数量超过模型限制", 400}
	}
	if !s.realEnabled {
		return Task{}, &APIError{"REAL_AI_DISABLED", "真实 AI 当前未启用", 503}
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	taskID := id()
	cost := model.CreditCost * int64(input.NumberOfImages)
	reservationID := ""
	if s.credits != nil {
		var reserveErr error
		reservationID, reserveErr = s.credits.Reserve(ctx, user.ID, taskID, input.IdempotencyKey, cost)
		if reserveErr != nil {
			return Task{}, &APIError{"INSUFFICIENT_CREDITS", "Credits 余额不足", 402}
		}
	}
	input.CreditReservationID = reservationID
	input.ResolvedProvider = model.Provider
	input.ResolvedCost = cost
	task, err := s.repository.Create(ctx, Task{ID: taskID, UserID: user.ID, IdempotencyKey: input.IdempotencyKey, Workflow: input.Workflow, LogicalModel: input.LogicalModel, WorkspaceID: input.WorkspaceID, ProductID: input.ProductID, SKUID: input.SKUID, CreditReservationID: reservationID, Provider: model.Provider, Model: input.Model, Cost: cost, Status: "reserved", Outputs: []Output{}, CreatedAt: now, UpdatedAt: now, Request: input})
	if err != nil {
		if reservationID != "" {
			_ = s.credits.Release(ctx, reservationID)
		}
		return Task{}, err
	}
	if task.Status != "reserved" {
		return task, nil
	}
	if s.enqueue != nil {
		if err := s.enqueue.Enqueue(ctx, task.ID); err != nil {
			s.fail(ctx, &task, "PROVIDER_UNAVAILABLE", "任务队列不可用")
			return Task{}, &APIError{"PROVIDER_UNAVAILABLE", "任务队列不可用", 503}
		}
	} else {
		go func() { _ = s.Execute(context.Background(), task.ID) }()
	}
	return task, nil
}
func (s *Service) Get(ctx context.Context, userID, taskID string) (Task, bool, error) {
	task, ok, err := s.repository.Get(ctx, taskID)
	if err != nil || !ok || task.UserID != userID {
		return Task{}, false, err
	}
	return task, true, nil
}
func (s *Service) List(ctx context.Context, userID string) ([]Task, error) {
	return s.repository.List(ctx, userID)
}
func (s *Service) Execute(ctx context.Context, taskID string) error {
	task, ok, err := s.repository.Get(ctx, taskID)
	if err != nil || !ok {
		return err
	}
	// River owns exclusive delivery of a queued job. A process can disappear after
	// persisting "running", and failed attempts are retried with the same provider
	// idempotency key, so only genuinely terminal states may short-circuit here.
	if task.Status == "success" || task.Status == "cancelled" {
		return nil
	}
	if task.Status == "failed" {
		if s.credits != nil && task.CreditReservationID != "" {
			return s.credits.Release(ctx, task.CreditReservationID)
		}
		return nil
	}
	if task.Status == "reconciling" {
		return s.finalize(ctx, &task)
	}
	task.Status = "running"
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	if err = s.repository.Update(ctx, task); err != nil {
		return err
	}
	input := task.Request
	ref := ""
	if len(input.ReferenceAssets) > 0 && s.refs != nil {
		if value, found := s.refs(input.ReferenceAssets[0].ObjectKey); found {
			ref = value
		}
	}
	if input.Mode != "text_to_image" && ref == "" {
		return s.fail(ctx, &task, "INVALID_REQUEST", "参考素材不可用")
	}
	result, err := s.provider.Generate(ctx, providers.ImageRequest{Model: input.Model, Provider: task.Provider, Prompt: input.Prompt, ReferenceImage: ref, IdempotencyKey: input.IdempotencyKey})
	if err != nil {
		code := "GENERATION_FAILED"
		message := err.Error()
		if pe, typed := err.(*providers.Error); typed {
			code = pe.Code
		}
		if failErr := s.fail(ctx, &task, code, message); failErr != nil {
			return failErr
		}
		return err
	}
	if len(result.Outputs) == 0 {
		return s.fail(ctx, &task, "GENERATION_FAILED", "Provider 未返回图片")
	}
	if s.storage == nil {
		return fmt.Errorf("generated asset storage is required")
	}
	task.Status = "reconciling"
	task.ProviderRequestID = result.ProviderRequestID
	task.Outputs = []Output{}
	for i, output := range result.Outputs {
		key, size, saveErr := s.storage.SaveGenerated(ctx, task.ID, i, output.URI, output.MediaType)
		if saveErr != nil {
			return saveErr
		}
		task.Outputs = append(task.Outputs, Output{ObjectKey: key, Size: size, MimeType: output.MediaType})
	}
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	if err = s.repository.Update(ctx, task); err != nil {
		return err
	}
	return s.finalize(ctx, &task)
}
func (s *Service) finalize(ctx context.Context, task *Task) error {
	if len(task.Outputs) == 0 || s.storage == nil {
		return fmt.Errorf("generated asset is unavailable")
	}
	// Reconcile tasks saved by the previous worker version, which stored a
	// provider URL or data URI in task.output before asset persistence existed.
	for i := range task.Outputs {
		if task.Outputs[i].ObjectKey != "" {
			continue
		}
		source := task.Outputs[i].TemporaryURL
		if source == "" {
			source = task.Outputs[i].Base64Data
		}
		key, size, err := s.storage.SaveGenerated(ctx, task.ID, i, source, task.Outputs[i].MimeType)
		if err != nil {
			return err
		}
		task.Outputs[i].ObjectKey, task.Outputs[i].Size = key, size
		task.Outputs[i].TemporaryURL, task.Outputs[i].Base64Data = "", ""
		if err := s.repository.Update(ctx, *task); err != nil {
			return err
		}
	}
	if s.credits != nil {
		for _, output := range task.Outputs {
			if err := s.storage.VerifyGenerated(output.ObjectKey, nil); err != nil {
				return err
			}
			if err := s.credits.RecordGeneratedAsset(ctx, task.UserID, task.WorkspaceID, task.Request.ProjectID, task.ProductID, task.SKUID, task.ID, output.ObjectKey, output.MimeType, output.Size); err != nil {
				return err
			}
		}
	} else {
		for _, output := range task.Outputs {
			if err := s.storage.VerifyGenerated(output.ObjectKey, nil); err != nil {
				return err
			}
		}
	}
	if s.credits != nil && task.CreditReservationID != "" {
		if err := s.credits.Confirm(ctx, task.CreditReservationID); err != nil {
			return err
		}
	}
	task.Status = "success"
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	return s.repository.Update(ctx, *task)
}
func (s *Service) Deliver(task *Task) error {
	if task.Status != "success" {
		return nil
	}
	for i := range task.Outputs {
		if task.Outputs[i].ObjectKey == "" {
			continue
		} // Legacy tasks retain their original response.
		if s.storage == nil {
			return fmt.Errorf("generated asset storage is required")
		}
		data, err := s.storage.GeneratedDataURL(task.Outputs[i].ObjectKey, task.Outputs[i].MimeType)
		if err != nil {
			return err
		}
		task.Outputs[i].Base64Data = data
	}
	return nil
}
func (s *Service) fail(ctx context.Context, task *Task, code, message string) error {
	task.Status = "failed"
	task.Error = &TaskError{code, message}
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	if err := s.repository.Update(ctx, *task); err != nil {
		return err
	}
	if s.credits != nil && task.CreditReservationID != "" {
		return s.credits.Release(ctx, task.CreditReservationID)
	}
	return nil
}
func validateBase(r Request) error {
	if r.IdempotencyKey == "" || len(r.IdempotencyKey) > 128 {
		return &APIError{"INVALID_REQUEST", "幂等键无效", 400}
	}
	if r.ProjectID == "" || r.InputAssetID == "" || r.Prompt == "" {
		return &APIError{"INVALID_REQUEST", "项目、素材和提示词不能为空", 400}
	}
	if r.NumberOfImages != 1 || r.Size != "1024x1024" {
		return &APIError{"INVALID_REQUEST", "当前仅允许生成一张 1024x1024 图片", 400}
	}
	if r.Mode != "text_to_image" && len(r.ReferenceAssets) == 0 {
		return &APIError{"INVALID_REQUEST", "参考图生成必须选择参考素材", 400}
	}
	return nil
}
func supports(capabilities []string, mode string) bool {
	if mode == "" {
		mode = "text_to_image"
	}
	for _, candidate := range capabilities {
		if candidate == mode {
			return true
		}
	}
	return false
}
func id() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b[:4]) + "-" + hex.EncodeToString(b[4:6]) + "-4" + hex.EncodeToString(b[6:8])[1:] + "-8" + hex.EncodeToString(b[8:10])[1:] + "-" + hex.EncodeToString(b[10:])
}
