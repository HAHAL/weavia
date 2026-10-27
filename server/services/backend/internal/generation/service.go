package generation

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/providers"
)

type Request struct {
	IdempotencyKey      string           `json:"idempotencyKey"`
	ClientBatchID       string           `json:"clientBatchId,omitempty"`
	ClientTitle         string           `json:"clientTitle,omitempty"`
	ParentWorkID        string           `json:"parentWorkId,omitempty"`
	QuotedCost          *int64           `json:"-"`
	QuoteID             string           `json:"quoteId"`
	ConversationID      string           `json:"conversationId"`
	MessageID           string           `json:"messageId"`
	WorkspaceID         string           `json:"workspaceId"`
	ProjectID           string           `json:"projectId"`
	ProductID           string           `json:"productId"`
	SKUID               string           `json:"skuId"`
	CreditReservationID string           `json:"creditReservationId,omitempty"`
	InputAssetID        string           `json:"inputAssetId"`
	Workflow            string           `json:"workflow"`
	LogicalModel        string           `json:"logicalModel"`
	ModelKey            string           `json:"modelKey"`
	SkillID             string           `json:"skillId,omitempty"`
	AppID               string           `json:"appId,omitempty"`
	Model               string           `json:"model"`
	Prompt              string           `json:"prompt"`
	DisplayPrompt       string           `json:"displayPrompt,omitempty"`
	Mode                string           `json:"mode"`
	EditMode            string           `json:"editMode,omitempty"`
	MaskAssetID         string           `json:"maskAssetId,omitempty"`
	MaskObjectKey       string           `json:"maskObjectKey,omitempty"`
	ReferenceAssets     []ReferenceAsset `json:"referenceAssets"`
	Size                string           `json:"size"`
	Ratio               string           `json:"ratio,omitempty"`
	Resolution          string           `json:"resolution,omitempty"`
	PromptExtend        bool             `json:"promptExtend,omitempty"`
	NegativePrompt      string           `json:"negativePrompt,omitempty"`
	Seed                string           `json:"seed,omitempty"`
	Watermark           bool             `json:"watermark,omitempty"`
	ReferenceStrength   float64          `json:"referenceStrength,omitempty"`
	Duration            int              `json:"duration,omitempty"`
	ReferenceURL        string           `json:"referenceUrl,omitempty"`
	Quality             string           `json:"quality"`
	NumberOfImages      int              `json:"numberOfImages"`
	OutputFormat        string           `json:"outputFormat"`
	Metadata            map[string]any   `json:"metadata"`
	Creative            *CreativeBrief   `json:"creative,omitempty"`
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
	SaveGenerated(context.Context, string, string, int, string, string) (string, int64, error)
	VerifyGenerated(string, []byte) error
	GeneratedDataURL(string, string) (string, error)
}
type Task struct {
	ClientBatchID       string         `json:"clientBatchId,omitempty"`
	ClientTitle         string         `json:"clientTitle,omitempty"`
	ParentWorkID        string         `json:"parentWorkId,omitempty"`
	ID                  string         `json:"id"`
	UserID              string         `json:"userId"`
	IdempotencyKey      string         `json:"idempotencyKey"`
	Workflow            string         `json:"workflow"`
	LogicalModel        string         `json:"logicalModel"`
	WorkspaceID         string         `json:"workspaceId"`
	ProductID           string         `json:"productId"`
	SKUID               string         `json:"skuId"`
	CreditReservationID string         `json:"creditReservationId"`
	Provider            string         `json:"provider"`
	Model               string         `json:"model"`
	Cost                int64          `json:"cost"`
	BillingBasis        string         `json:"billingBasis,omitempty"`
	Billing             *TaskBilling   `json:"billing,omitempty"`
	Status              string         `json:"status"`
	Prompt              string         `json:"prompt,omitempty"`
	Mode                string         `json:"mode,omitempty"`
	Ratio               string         `json:"ratio,omitempty"`
	Resolution          string         `json:"resolution,omitempty"`
	Count               int            `json:"count,omitempty"`
	Creative            *CreativeBrief `json:"creative,omitempty"`
	Outputs             []Output       `json:"outputs"`
	ProviderRequestID   string         `json:"providerRequestId,omitempty"`
	ProviderTaskID      string         `json:"providerTaskId,omitempty"`
	Error               *TaskError     `json:"error,omitempty"`
	CreatedAt           string         `json:"createdAt"`
	UpdatedAt           string         `json:"updatedAt"`
	Request             Request        `json:"-"`
}
type TaskError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
type Enqueuer interface {
	Enqueue(context.Context, string) error
}
type TaskObserver interface {
	Record(context.Context, string, string, string, string, time.Duration) error
	StartRun(context.Context, string) error
	FinishRun(context.Context, string, string) error
}
type Generator interface {
	Generate(context.Context, providers.ImageRequest) (providers.ImageResult, error)
}
type Repository interface {
	Create(context.Context, Task) (Task, error)
	Get(context.Context, string) (Task, bool, error)
	List(context.Context, string) ([]Task, error)
	Update(context.Context, Task) error
	SnapshotBillingBasis(context.Context, string, string, string) error
	ListRunningVideo(context.Context) ([]Task, error)
}
type Credits interface {
	Reserve(context.Context, string, string, string, int64) (string, error)
	Confirm(context.Context, string) error
	SettleDelivered(context.Context, string, int64) error
	Release(context.Context, string) error
	RecordGeneratedAsset(context.Context, string, string, string, string, string, string, string, string, int64) error
}

type RouteModel struct {
	Params       map[string]any
	Key          string
	DisplayName  string
	CreditsCost  int64
	Capabilities []string
}
type RouteBinding struct {
	ID              string
	ChannelID       string
	ChannelModelID  string
	ChannelName     string
	Provider        string
	ProviderModelID string
	BillingBasis    string
	BaseURL         string
	APIKey          string
	KeyID           string
	Priority        int
	Weight          int
}
type LogicalRouter interface {
	LookupRoute(context.Context, string) (RouteModel, error)
	BindingsFor(context.Context, string) ([]RouteBinding, error)
	RecordRoute(context.Context, string, error)
	LogRoute(context.Context, string, string, string, string, string, string, int, string, string, time.Duration)
	Retryable(error) bool
}

type Service struct {
	repository  Repository
	enqueue     Enqueuer
	provider    Generator
	realEnabled bool
	mock        bool
	refs        func(string) (string, bool)
	credits     Credits
	registry    Registry
	storage     GeneratedStorage
	router      LogicalRouter
	observer    TaskObserver
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
func (s *Service) WithMock(mock bool) *Service                   { s.mock = mock; return s }
func (s *Service) WithRouting(router LogicalRouter) *Service     { s.router = router; return s }
func (s *Service) WithObserver(observer TaskObserver) *Service   { s.observer = observer; return s }
func (s *Service) observe(ctx context.Context, taskID, stage, state, code string, elapsed time.Duration) {
	if s.observer != nil {
		if err := s.observer.Record(ctx, taskID, stage, state, code, elapsed); err != nil {
			slog.Warn("task event recording failed", "task_id", taskID, "stage", stage, "error", err)
		}
	}
}

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

// bindingsFor 优先按账户分组选渠道，未配置时回退到全局顺序。
func (s *Service) bindingsFor(ctx context.Context, userID, key string) ([]RouteBinding, error) {
	if s.router == nil {
		return nil, nil
	}
	if userID != "" {
		if aware, ok := s.router.(interface {
			BindingsForAccount(context.Context, string, string) ([]RouteBinding, error)
		}); ok {
			return aware.BindingsForAccount(ctx, userID, key)
		}
	}
	return s.router.BindingsFor(ctx, key)
}

// priceFor 优先使用账户分组倍率后的价格。
func (s *Service) priceFor(ctx context.Context, userID, key string, fallback int64) int64 {
	if s.router == nil {
		return fallback
	}
	if aware, ok := s.router.(interface {
		PriceFor(context.Context, string, string) (int64, error)
	}); ok {
		if price, err := aware.PriceFor(ctx, userID, key); err == nil && price > 0 {
			return price
		}
	}
	return fallback
}

func (s *Service) Create(ctx context.Context, user auth.User, input Request) (Task, error) {
	if input.Mode == "" {
		input.Mode = "text_to_image"
	}
	if err := validateBase(input, s.mock); err != nil {
		return Task{}, err
	}
	input.DisplayPrompt = input.Prompt
	if err := prepareCreative(&input); err != nil {
		return Task{}, err
	}
	model, err := s.resolveModel(ctx, user, &input)
	if err != nil {
		return Task{}, err
	}
	if !s.realEnabled && !s.mock {
		return Task{}, &APIError{"REAL_AI_DISABLED", "真实 AI 当前未启用", 503}
	}
	if previous, found, lookupErr := s.FindIdempotent(ctx, user.ID, input.IdempotencyKey); lookupErr != nil {
		return Task{}, lookupErr
	} else if found {
		return previous, nil
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	taskID := id()
	if input.IdempotencyKey != "" {
		sum := sha256.Sum256([]byte(user.ID + "\x00" + input.IdempotencyKey))
		taskID = fmt.Sprintf("%x-%x-%x-%x-%x", sum[:4], sum[4:6], sum[6:8], sum[8:10], sum[10:16])
	}
	cost, err := requestCost(model, input)
	if err != nil {
		return Task{}, err
	}
	if input.QuotedCost != nil && *input.QuotedCost != cost {
		return Task{}, &APIError{"QUOTE_CHANGED", "价格已更新，请重新确认报价", 409}
	}
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
	task, err := s.repository.Create(ctx, Task{ClientBatchID: input.ClientBatchID, ClientTitle: input.ClientTitle, ParentWorkID: input.ParentWorkID, ID: taskID, UserID: user.ID, IdempotencyKey: input.IdempotencyKey, Workflow: input.Workflow, LogicalModel: input.LogicalModel, WorkspaceID: input.WorkspaceID, ProductID: input.ProductID, SKUID: input.SKUID, CreditReservationID: reservationID, Provider: model.Provider, Model: input.Model, Cost: cost, Status: "reserved", Prompt: input.DisplayPrompt, Mode: input.Mode, Ratio: input.Ratio, Resolution: input.Resolution, Count: input.NumberOfImages, Creative: input.Creative, Outputs: []Output{}, CreatedAt: now, UpdatedAt: now, Request: input})
	if err != nil {
		if reservationID != "" {
			_ = s.credits.Release(ctx, reservationID)
		}
		return Task{}, err
	}
	if task.Status != "reserved" {
		return task, nil
	}
	s.observe(ctx, task.ID, "reserved", "success", "", 0)
	if s.enqueue != nil {
		if err := s.enqueue.Enqueue(ctx, task.ID); err != nil {
			s.fail(ctx, &task, "PROVIDER_UNAVAILABLE", "任务队列不可用")
			return Task{}, &APIError{"PROVIDER_UNAVAILABLE", "任务队列不可用", 503}
		}
	} else {
		go func() { _ = s.Execute(context.Background(), task.ID) }()
	}
	s.observe(ctx, task.ID, "queued", "success", "", 0)
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
func (s *Service) CleanupStaleVideo(ctx context.Context, olderThan time.Duration) (int, error) {
	tasks, err := s.repository.ListRunningVideo(ctx)
	if err != nil {
		return 0, err
	}
	cleaned := 0
	for _, task := range tasks {
		created, parseErr := time.Parse(time.RFC3339Nano, task.CreatedAt)
		if parseErr != nil || time.Since(created) < olderThan {
			continue
		}
		if err := s.fail(ctx, &task, "TIMEOUT", "视频任务超时，已自动关闭"); err != nil {
			return cleaned, err
		}
		cleaned++
	}
	return cleaned, nil
}

func (s *Service) ResumeVideoTasks(ctx context.Context) {
	tasks, err := s.repository.ListRunningVideo(ctx)
	if err != nil {
		return
	}
	resumer, ok := s.provider.(interface {
		Resume(context.Context, string) (providers.ImageResult, error)
	})
	if !ok {
		return
	}
	for _, task := range tasks {
		if task.ProviderTaskID == "" {
			continue
		}
		var result providers.ImageResult
		var err error
		usedConfigured := false
		if task.LogicalModel != "" && s.router != nil {
			if bindings, lookupErr := s.bindingsFor(ctx, task.UserID, task.LogicalModel); lookupErr == nil && len(bindings) > 0 {
				if configured, ok := s.provider.(interface {
					ResumeWithConfig(context.Context, string, string, string) (providers.ImageResult, error)
				}); ok {
					result, err = configured.ResumeWithConfig(ctx, task.ProviderTaskID, bindings[0].APIKey, bindings[0].BaseURL)
					usedConfigured = true
				}
			}
		}
		if !usedConfigured {
			result, err = resumer.Resume(ctx, task.ProviderTaskID)
		}
		if err != nil {
			continue
		}
		task.Outputs = make([]Output, len(result.Outputs))
		for i, output := range result.Outputs {
			task.Outputs[i] = Output{TemporaryURL: output.URI, MimeType: output.MediaType}
		}
		task.ProviderRequestID = result.ProviderRequestID
		if err := s.finalize(ctx, &task); err != nil {
			_ = s.fail(ctx, &task, "GENERATION_FAILED", "视频结果保存失败")
		}
	}
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
	if s.observer != nil {
		if err := s.observer.StartRun(ctx, task.ID); err != nil {
			slog.Warn("task run recording failed", "task_id", task.ID, "error", err)
		}
	}
	s.observe(ctx, task.ID, "worker_started", "success", "", 0)
	input := task.Request
	maskRef := ""
	if input.MaskObjectKey != "" && s.refs != nil {
		if value, found := s.refs(input.MaskObjectKey); found {
			maskRef = value
		}
	}
	ref := ""
	if len(input.ReferenceAssets) > 0 && s.refs != nil {
		if value, found := s.refs(input.ReferenceAssets[0].ObjectKey); found {
			ref = value
		}
	}
	if (input.Mode == "image_edit" || input.Mode == "image_to_image") && ref == "" {
		return s.fail(ctx, &task, "INVALID_REQUEST", "参考素材不可用")
	}
	result, err := s.generate(ctx, &task, providers.ImageRequest{Model: input.Model, Provider: task.Provider, Prompt: input.Prompt, ReferenceImage: ref, MaskImage: maskRef, Size: input.Size, Count: input.NumberOfImages, PromptExtend: input.PromptExtend, NegativePrompt: input.NegativePrompt, Seed: input.Seed, OutputFormat: input.OutputFormat, Watermark: input.Watermark, ReferenceStrength: input.ReferenceStrength, ReferenceURL: input.ReferenceURL, IdempotencyKey: input.IdempotencyKey, Mode: input.Mode, Duration: input.Duration, OnSubmitted: func(providerTaskID string) {
		task.ProviderTaskID = providerTaskID
		task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		_ = s.repository.Update(ctx, task)
		s.observe(ctx, task.ID, "provider_submitted", "success", "", 0)
	}})
	if err != nil {
		code := "GENERATION_FAILED"
		message := err.Error()
		if task.LogicalModel != "" {
			code = "GENERATION_UNAVAILABLE"
			message = "生成服务繁忙，请稍后重试"
		} else if pe, typed := err.(*providers.Error); typed {
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
		key, size, saveErr := s.storage.SaveGenerated(ctx, task.UserID, task.ID, i, output.URI, output.MediaType)
		if saveErr != nil {
			s.observe(ctx, task.ID, "asset_saved", "failed", "STORAGE_ERROR", 0)
			return saveErr
		}
		task.Outputs = append(task.Outputs, Output{ObjectKey: key, Size: size, MimeType: output.MediaType})
		s.observe(ctx, task.ID, "asset_saved", "success", "", 0)
	}
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	if err = s.repository.Update(ctx, task); err != nil {
		return err
	}
	return s.finalize(ctx, &task)
}
func (s *Service) generate(ctx context.Context, task *Task, base providers.ImageRequest) (providers.ImageResult, error) {
	if task.LogicalModel == "" || s.router == nil {
		return s.provider.Generate(ctx, base)
	}
	bindings, err := s.bindingsFor(ctx, task.UserID, task.LogicalModel)
	if err != nil || len(bindings) == 0 {
		return providers.ImageResult{}, &providers.Error{Code: "NO_CHANNEL", Message: "no available channel", Retryable: false, Status: 503}
	}
	// One task submits to exactly one provider. A failed task must be retried by
	// the customer as a new task; we never resubmit automatically.
	binding := bindings[0]
	request := base
	request.Provider = binding.Provider
	request.Model = binding.ProviderModelID
	request.APIKey = binding.APIKey
	request.BaseURL = binding.BaseURL
	// Capture the provider's billing rule before submission. A later channel
	// configuration edit must not change settlement for an in-flight task.
	if err := s.repository.SnapshotBillingBasis(ctx, task.ID, binding.BillingBasis, binding.ChannelModelID); err != nil {
		return providers.ImageResult{}, err
	}
	started := time.Now()
	s.observe(ctx, task.ID, "provider_request", "started", "", 0)
	result, callErr := s.provider.Generate(ctx, request)
	providerCode := ""
	if pe, ok := callErr.(*providers.Error); ok {
		providerCode = pe.Code
	}
	providerState := "success"
	if callErr != nil {
		providerState = "failed"
	}
	s.observe(ctx, task.ID, "provider_response", providerState, providerCode, time.Since(started))
	s.router.RecordRoute(ctx, binding.ID, callErr)
	status, code := "success", ""
	if callErr != nil {
		status = "failed"
		code = "PROVIDER_ERROR"
		if pe, ok := callErr.(*providers.Error); ok {
			code = pe.Code
		}
	}
	s.router.LogRoute(ctx, task.ID, task.LogicalModel, binding.ChannelID, binding.ChannelModelID, binding.ProviderModelID, binding.KeyID, 1, status, code, time.Since(started))
	if callErr != nil {
		return providers.ImageResult{}, callErr
	}
	task.Provider = binding.Provider
	task.Model = binding.ProviderModelID
	return result, nil
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
		key, size, err := s.storage.SaveGenerated(ctx, task.UserID, task.ID, i, source, task.Outputs[i].MimeType)
		if err != nil {
			s.observe(ctx, task.ID, "asset_saved", "failed", "STORAGE_ERROR", 0)
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
		// 按上游实际交付结算：少返几张就少扣几张，渠道若提交即计费则在服务端按请求数结算。
		if err := s.credits.SettleDelivered(ctx, task.CreditReservationID, int64(len(task.Outputs))); err != nil {
			s.observe(ctx, task.ID, "settled", "failed", "SETTLEMENT_ERROR", 0)
			return err
		}
	}
	task.Status = "success"
	task.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	if err := s.repository.Update(ctx, *task); err != nil {
		return err
	}
	s.observe(ctx, task.ID, "settled", "success", "", 0)
	if s.observer != nil {
		_ = s.observer.FinishRun(ctx, task.ID, "success")
	}
	return nil
}
func (s *Service) Deliver(task *Task) error {
	if task.Status != "success" {
		return nil
	}
	for i := range task.Outputs {
		if task.Outputs[i].ObjectKey == "" {
			continue
		} // Legacy tasks retain their original response.
		if task.Outputs[i].MimeType == "video/mp4" || task.Outputs[i].MimeType == "video/webm" {
			continue // Video files are fetched through the authenticated output endpoint.
		}
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
	var releaseErr error
	if s.credits != nil && task.CreditReservationID != "" {
		releaseErr = s.credits.Release(ctx, task.CreditReservationID)
	}
	s.observe(ctx, task.ID, "failed", "failed", code, 0)
	if releaseErr != nil {
		s.observe(ctx, task.ID, "refund", "failed", "REFUND_ERROR", 0)
	}
	if s.observer != nil {
		_ = s.observer.FinishRun(ctx, task.ID, "failed")
	}
	return releaseErr
}
func validateBase(r Request, mock bool) error {
	if r.IdempotencyKey == "" || len(r.IdempotencyKey) > 128 {
		return &APIError{"INVALID_REQUEST", "幂等键无效", 400}
	}
	if r.Prompt == "" {
		return &APIError{"INVALID_REQUEST", "提示词不能为空", 400}
	}
	if (r.Mode == "image_edit" || r.Mode == "image_to_image") && (r.ProjectID == "" || r.InputAssetID == "") {
		return &APIError{"INVALID_REQUEST", "图片编辑任务需要项目和输入素材", 400}
	}
	if r.NumberOfImages < 1 || r.NumberOfImages > 4 {
		return &APIError{"INVALID_REQUEST", "生成数量必须在 1-4 张之间", 400}
	}
	if r.Mode == "text_to_video" || r.Mode == "image_to_video" {
		if r.NumberOfImages != 1 || r.Duration < 1 || r.Duration > 30 {
			return &APIError{"INVALID_REQUEST", "视频任务需要单条结果和有效时长", 400}
		}
	}
	if r.Size == "" {
		r.Size = "1024x1024"
	}
	validSizes := map[string]bool{"1280x720": true, "720x1280": true, "1920x1080": true, "1080x1920": true, "1280*720": true, "720*1280": true, "1920*1080": true, "1080*1920": true, "1024x1024": true, "819x1024": true, "768x1024": true, "1024x576": true, "576x1024": true, "2048x2048": true, "1638x2048": true, "1536x2048": true, "2048x1152": true, "1152x2048": true, "4096x4096": true, "3277x4096": true, "3072x4096": true, "4096x2304": true, "2304x4096": true}
	if !validSizes[r.Size] {
		return &APIError{"INVALID_REQUEST", "不支持的图片尺寸", 400}
	}
	if (r.Mode == "image_edit" || r.Mode == "image_to_image") && len(r.ReferenceAssets) == 0 {
		return &APIError{"INVALID_REQUEST", "参考图生成必须选择参考素材", 400}
	}
	if r.EditMode == "region" && r.MaskObjectKey == "" {
		return &APIError{"INVALID_REQUEST", "局部改图必须提供 mask", 400}
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

// Preview uses the exact same route and account price as Create, without reserving credits.
func (s *Service) Preview(ctx context.Context, user auth.User, input Request) (int64, error) {
	input.IdempotencyKey = "preview"
	if err := validateBase(input, s.mock); err != nil {
		return 0, err
	}
	if err := prepareCreative(&input); err != nil {
		return 0, err
	}
	model, err := s.resolveModel(ctx, user, &input)
	if err != nil {
		return 0, err
	}
	if !s.realEnabled && !s.mock {
		return 0, &APIError{"REAL_AI_DISABLED", "真实 AI 当前未启用", 503}
	}
	return requestCost(model, input)
}
func (s *Service) resolveModel(ctx context.Context, user auth.User, input *Request) (RegisteredModel, error) {
	var model RegisteredModel
	var err error
	if input.ModelKey != "" && s.router != nil {
		info, routeErr := s.router.LookupRoute(ctx, input.ModelKey)
		if routeErr != nil {
			return RegisteredModel{}, &APIError{"UNSUPPORTED_MODEL", "模型不可用", 400}
		}
		bindings, routeErr := s.bindingsFor(ctx, user.ID, input.ModelKey)
		if routeErr != nil || len(bindings) == 0 {
			return RegisteredModel{}, &APIError{"MODEL_UNAVAILABLE", "生成服务繁忙，请稍后重试", 503}
		}
		input.LogicalModel = input.ModelKey
		input.Model = bindings[0].ProviderModelID
		model = RegisteredModel{Name: bindings[0].ProviderModelID, Provider: bindings[0].Provider, Enabled: true, CreditCost: s.priceFor(ctx, user.ID, input.ModelKey, info.CreditsCost), Capabilities: info.Capabilities, Metadata: info.Params}
	} else {
		model, err = s.registry.Lookup(ctx, input.Model)
		if err != nil || !model.Enabled || model.Provider == "" || model.CreditCost <= 0 {
			return RegisteredModel{}, &APIError{"UNSUPPORTED_MODEL", "模型不可用", 400}
		}
	}
	if !supports(model.Capabilities, input.Mode) {
		return RegisteredModel{}, &APIError{"UNSUPPORTED_CAPABILITY", "当前模型不支持所选生成方式", 400}
	}
	if max, ok := model.Metadata["maxReferences"].(float64); ok && len(input.ReferenceAssets) > int(max) {
		return RegisteredModel{}, &APIError{"INVALID_REQUEST", "参考图数量超过模型限制", 400}
	}
	return model, nil
}
func requestCost(model RegisteredModel, input Request) (int64, error) {
	multiplier := int64(1)
	switch input.Resolution {
	case "2K":
		multiplier = 2
	case "4K":
		multiplier = 4
	}
	if input.Mode == "text_to_video" || input.Mode == "image_to_video" {
		// The configured base price is per second only after an operator verifies it.
		verified, _ := model.Metadata["videoPricingVerified"].(bool)
		if !verified {
			return 0, &APIError{"VIDEO_PRICING_UNVERIFIED", "视频价格尚未核实，暂不能提交；请联系运营开通", 409}
		}
		return model.CreditCost * int64(input.Duration), nil
	}
	return model.CreditCost * int64(input.NumberOfImages) * multiplier, nil
}

type TaskBilling struct {
	Reserved int64  `json:"reserved"`
	Consumed int64  `json:"consumed"`
	Released int64  `json:"released"`
	Basis    string `json:"basis"`
}

func (s *Service) FindIdempotent(ctx context.Context, userID, key string) (Task, bool, error) {
	if finder, ok := s.repository.(interface {
		FindIdempotent(context.Context, string, string) (Task, bool, error)
	}); ok {
		return finder.FindIdempotent(ctx, userID, key)
	}
	tasks, err := s.repository.List(ctx, userID)
	for _, task := range tasks {
		if task.IdempotencyKey == key {
			return task, true, nil
		}
	}
	return Task{}, false, err
}
