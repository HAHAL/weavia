package generation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/providers"
)

type Request struct {
	IdempotencyKey  string           `json:"idempotencyKey"`
	ProjectID       string           `json:"projectId"`
	InputAssetID    string           `json:"inputAssetId"`
	Workflow        string           `json:"workflow"`
	LogicalModel    string           `json:"logicalModel"`
	Model           string           `json:"model"`
	Prompt          string           `json:"prompt"`
	Mode            string           `json:"mode"`
	ReferenceAssets []ReferenceAsset `json:"referenceAssets"`
	Size            string           `json:"size"`
	Quality         string           `json:"quality"`
	NumberOfImages  int              `json:"numberOfImages"`
	OutputFormat    string           `json:"outputFormat"`
	Metadata        map[string]any   `json:"metadata"`
}
type ReferenceAsset struct {
	AssetID   string `json:"assetId"`
	ObjectKey string `json:"objectKey"`
	MimeType  string `json:"mimeType"`
}
type Output struct {
	TemporaryURL string `json:"temporaryUrl,omitempty"`
	Base64Data   string `json:"base64Data,omitempty"`
	MimeType     string `json:"mimeType"`
}
type Task struct {
	ID                string     `json:"id"`
	UserID            string     `json:"userId"`
	IdempotencyKey    string     `json:"idempotencyKey"`
	Workflow          string     `json:"workflow"`
	LogicalModel      string     `json:"logicalModel"`
	Status            string     `json:"status"`
	Outputs           []Output   `json:"outputs"`
	ProviderRequestID string     `json:"providerRequestId,omitempty"`
	Error             *TaskError `json:"error,omitempty"`
	CreatedAt         string     `json:"createdAt"`
	UpdatedAt         string     `json:"updatedAt"`
	Request           Request    `json:"-"`
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

type Service struct {
	repository  Repository
	enqueue     Enqueuer
	provider    Generator
	realEnabled bool
	refs        func(string) (string, bool)
}

func NewService(realEnabled bool, provider Generator, enqueue Enqueuer, refs func(string) (string, bool), repository Repository) *Service {
	if repository == nil {
		repository = NewMemoryRepository()
	}
	return &Service{repository: repository, realEnabled: realEnabled, provider: provider, enqueue: enqueue, refs: refs}
}

func (s *Service) Create(ctx context.Context, user auth.User, input Request) (Task, error) {
	if err := validate(input); err != nil {
		return Task{}, err
	}
	if !s.realEnabled {
		return Task{}, &APIError{"REAL_AI_DISABLED", "真实 AI 当前未启用", 503}
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	task, err := s.repository.Create(ctx, Task{ID: id(), UserID: user.ID, IdempotencyKey: input.IdempotencyKey, Workflow: input.Workflow, LogicalModel: input.LogicalModel, Status: "queued", Outputs: []Output{}, CreatedAt: now, UpdatedAt: now, Request: input})
	if err != nil {
		return Task{}, err
	}
	if task.Status != "queued" {
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
	if task.Status == "generated" || task.Status == "cancelled" || task.Status == "failed" || task.Status == "running" {
		return nil
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
	result, err := s.provider.Generate(ctx, providers.ImageRequest{Model: input.Model, Prompt: input.Prompt, ReferenceImage: ref, IdempotencyKey: input.IdempotencyKey})
	if err != nil {
		code := "GENERATION_FAILED"
		message := err.Error()
		if pe, typed := err.(*providers.Error); typed {
			code = pe.Code
		}
		s.fail(ctx, &task, code, message)
		return err
	}
	task.Status = "generated"
	task.ProviderRequestID = result.ProviderRequestID
	task.Outputs = []Output{}
	for _, output := range result.Outputs {
		if len(output.URI) > 5 && output.URI[:5] == "data:" {
			task.Outputs = append(task.Outputs, Output{Base64Data: output.URI, MimeType: output.MediaType})
		} else {
			task.Outputs = append(task.Outputs, Output{TemporaryURL: output.URI, MimeType: output.MediaType})
		}
	}
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	return s.repository.Update(ctx, task)
}
func (s *Service) fail(ctx context.Context, task *Task, code, message string) {
	task.Status = "failed"
	task.Error = &TaskError{code, message}
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	_ = s.repository.Update(ctx, *task)
}
func validate(r Request) error {
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
	if len(r.ReferenceAssets) > 1 && r.Model == "qwen-image-2.0" {
		return &APIError{"INVALID_REQUEST", "qwen-image-2.0 当前仅支持单张商品参考图", 400}
	}
	var selected *Model
	for index := range Models {
		if Models[index].ModelID == r.Model && Models[index].Enabled {
			selected = &Models[index]
			break
		}
	}
	if selected == nil {
		return &APIError{"UNSUPPORTED_MODEL", "模型不可用", 400}
	}
	capability := r.Mode
	if capability == "" {
		capability = "text_to_image"
	}
	supported := false
	for _, candidate := range selected.Capabilities {
		if candidate == capability {
			supported = true
			break
		}
	}
	if !supported {
		return &APIError{"UNSUPPORTED_CAPABILITY", "当前模型不支持所选生成方式", 400}
	}
	return nil
}
func id() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b[:4]) + "-" + hex.EncodeToString(b[4:6]) + "-4" + hex.EncodeToString(b[6:8])[1:] + "-8" + hex.EncodeToString(b[8:10])[1:] + "-" + hex.EncodeToString(b[10:])
}
