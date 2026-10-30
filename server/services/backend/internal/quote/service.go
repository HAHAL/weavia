package quote

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Request struct {
	ConversationID    string   `json:"conversationId,omitempty"`
	WorkspaceID       string   `json:"workspaceId,omitempty"`
	ProjectID         string   `json:"projectId,omitempty"`
	Model             string   `json:"model"`
	Mode              string   `json:"mode"`
	EditMode          string   `json:"editMode,omitempty"`
	Prompt            string   `json:"prompt"`
	Size              string   `json:"size"`
	NumberOfImages    int      `json:"numberOfImages"`
	ReferenceAssetIDs []string `json:"referenceAssetIds,omitempty"`
	MaskAssetID       string   `json:"maskAssetId,omitempty"`
}

type LineItem struct {
	Model        string `json:"model"`
	Quantity     int    `json:"quantity"`
	UnitCredits  int64  `json:"unitCredits"`
	TotalCredits int64  `json:"totalCredits"`
	Note         string `json:"note,omitempty"`
}

type Quote struct {
	ID             string     `json:"id"`
	UserID         string     `json:"-"`
	ConversationID string     `json:"conversationId,omitempty"`
	WorkspaceID    string     `json:"workspaceId,omitempty"`
	Currency       string     `json:"currency"`
	TotalCredits   int64      `json:"totalCredits"`
	LineItems      []LineItem `json:"lineItems"`
	Status         string     `json:"status"`
	ExpiresAt      time.Time  `json:"expiresAt"`
	CreatedAt      time.Time  `json:"createdAt"`
	ConsumedAt     *time.Time `json:"consumedAt,omitempty"`

	// Internal request snapshot fields for validation; never serialized.
	RequestModel        string          `json:"-"`
	RequestMode         string          `json:"-"`
	RequestPrompt       string          `json:"-"`
	RequestEditMode     string          `json:"-"`
	RequestSize         string          `json:"-"`
	RequestCount        int             `json:"-"`
	RequestReferenceIDs []string        `json:"-"`
	RequestMaskAssetID  string          `json:"-"`
	Request             json.RawMessage `json:"-"`
	IdempotencyKey      string          `json:"-"`
}

type ModelPrice struct {
	Credits      int64
	Enabled      bool
	Capabilities []string
}

type Pricer interface {
	Price(ctx context.Context, userID, model string) (ModelPrice, error)
}

type Store interface {
	Create(context.Context, Quote) (Quote, error)
	Get(context.Context, string, string) (Quote, error)
	Consume(context.Context, string, string) (Quote, error)
}

type Service struct {
	store  Store
	pricer Pricer
	now    func() time.Time
}

func New(store Store, pricer Pricer) *Service {
	return &Service{store: store, pricer: pricer, now: time.Now}
}
func NewPostgres(pool *pgxpool.Pool) *Service {
	return New(&postgresStore{pool: pool}, &postgresPricer{pool: pool})
}

// WithPricer swaps the price source, e.g. for the routing-aware generation price.
func (s *Service) WithPricer(p Pricer) *Service { s.pricer = p; return s }

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Service) Create(ctx context.Context, userID string, req Request, idempotencyKey string) (Quote, error) {
	if strings.TrimSpace(req.Model) == "" || strings.TrimSpace(req.Prompt) == "" {
		return Quote{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "模型和提示词不能为空", Status: 400}
	}
	if req.Mode == "" {
		req.Mode = "text_to_image"
	}
	video := req.Mode == "text_to_video" || req.Mode == "image_to_video"
	switch req.Mode {
	case "text_to_image", "image_to_image", "image_edit", "text_to_video", "image_to_video":
	default:
		return Quote{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "生成模式无效", Status: 400}
	}
	if req.Size == "" {
		req.Size = "1024x1024"
	}
	if req.NumberOfImages == 0 {
		req.NumberOfImages = 1
	}
	if !generation.ValidSize(req.Size) {
		return Quote{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "不支持的尺寸", Status: 400}
	}
	if req.NumberOfImages < 1 || req.NumberOfImages > 4 || (video && req.NumberOfImages != 1) {
		return Quote{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "数量必须在 1-4 之间，视频为 1 条", Status: 400}
	}
	if req.EditMode != "" && req.EditMode != "whole" && req.EditMode != "region" {
		return Quote{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "编辑模式无效", Status: 400}
	}
	if (req.Mode == "image_to_image" || req.Mode == "image_edit" || req.Mode == "image_to_video") && len(req.ReferenceAssetIDs) == 0 {
		return Quote{}, &generation.APIError{Code: "REFERENCE_REQUIRED", Message: "改图任务需要参考图", Status: 400}
	}
	if req.EditMode == "region" && req.MaskAssetID == "" {
		return Quote{}, &generation.APIError{Code: "MASK_REQUIRED", Message: "局部改图必须提供 mask", Status: 400}
	}
	price, err := s.pricer.Price(ctx, userID, req.Model)
	if err != nil || !price.Enabled || price.Credits <= 0 {
		return Quote{}, &generation.APIError{Code: "UNSUPPORTED_MODEL", Message: "模型不可用", Status: 400}
	}
	if !supports(price.Capabilities, req.Mode) {
		return Quote{}, &generation.APIError{Code: "UNSUPPORTED_CAPABILITY", Message: "当前模型不支持所选生成方式", Status: 400}
	}
	if idempotencyKey == "" {
		idempotencyKey = "quote-" + newID()
	}
	if len(idempotencyKey) > 128 {
		return Quote{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "幂等键无效", Status: 400}
	}
	now := s.now().UTC()
	unit := price.Credits * generation.SizeMultiplier(req.Mode, req.Size)
	total := generation.TaskCredits(price.Credits, req.Mode, req.Size, req.NumberOfImages)
	line := []LineItem{{Model: req.Model, Quantity: req.NumberOfImages, UnitCredits: unit, TotalCredits: total, Note: req.Size}}
	requestJSON, _ := json.Marshal(req)
	return s.store.Create(ctx, Quote{
		UserID:              userID,
		ConversationID:      req.ConversationID,
		WorkspaceID:         req.WorkspaceID,
		Currency:            "credits",
		TotalCredits:        total,
		LineItems:           line,
		Status:              "active",
		ExpiresAt:           now.Add(5 * time.Minute),
		CreatedAt:           now,
		Request:             requestJSON,
		IdempotencyKey:      idempotencyKey,
		RequestModel:        req.Model,
		RequestMode:         req.Mode,
		RequestPrompt:       req.Prompt,
		RequestEditMode:     req.EditMode,
		RequestSize:         req.Size,
		RequestCount:        req.NumberOfImages,
		RequestReferenceIDs: req.ReferenceAssetIDs,
		RequestMaskAssetID:  req.MaskAssetID,
	})
}

// Quote carries the request snapshot only for persistence; expose it through
// a separate field so API responses do not leak the raw snapshot.
type quoteRow struct {
	Quote
	Request        json.RawMessage
	IdempotencyKey string
}

func (s *Service) ValidateForTask(ctx context.Context, userID, quoteID string, req Request) (Quote, error) {
	q, err := s.store.Get(ctx, userID, quoteID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Quote{}, &generation.APIError{Code: "NOT_FOUND", Message: "报价不存在", Status: 404}
	}
	if err != nil {
		return Quote{}, err
	}
	if q.Status != "active" || !q.ExpiresAt.After(s.now()) {
		return Quote{}, &generation.APIError{Code: "QUOTE_EXPIRED", Message: "报价已失效，请重新报价", Status: 409}
	}
	if q.RequestModel != req.Model || q.RequestMode != req.Mode || q.RequestPrompt != req.Prompt || q.RequestEditMode != req.EditMode || q.RequestSize != req.Size || q.RequestCount != req.NumberOfImages || q.RequestMaskAssetID != req.MaskAssetID || !sameStrings(q.RequestReferenceIDs, req.ReferenceAssetIDs) {
		return Quote{}, &generation.APIError{Code: "QUOTE_MISMATCH", Message: "报价参数已变化，请重新报价", Status: 409}
	}
	return q, nil
}

func (s *Service) Consume(ctx context.Context, userID, quoteID string) (Quote, error) {
	q, err := s.store.Consume(ctx, userID, quoteID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Quote{}, &generation.APIError{Code: "QUOTE_EXPIRED", Message: "报价已失效，请重新报价", Status: 409}
	}
	return q, err
}

func (s *Service) Get(ctx context.Context, userID, quoteID string) (Quote, error) {
	q, err := s.store.Get(ctx, userID, quoteID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Quote{}, &generation.APIError{Code: "NOT_FOUND", Message: "报价不存在", Status: 404}
	}
	return q, err
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func supports(capabilities []string, mode string) bool {
	for _, c := range capabilities {
		if c == mode {
			return true
		}
	}
	return false
}

type postgresPricer struct{ pool *pgxpool.Pool }

func (p *postgresPricer) Price(ctx context.Context, _ string, model string) (ModelPrice, error) {
	var price ModelPrice
	var caps []byte
	err := p.pool.QueryRow(ctx, `SELECT coalesce(credit_cost,0),enabled,capabilities FROM ai_models WHERE model_name=$1`, model).Scan(&price.Credits, &price.Enabled, &caps)
	if err != nil {
		return price, err
	}
	_ = json.Unmarshal(caps, &price.Capabilities)
	return price, nil
}

const quoteCols = `id::text,user_id::text,coalesce(workspace_id::text,''),coalesce(conversation_id::text,''),currency,total_credits,line_items,request,status,expires_at,created_at,consumed_at,idempotency_key`

func scanQuote(row pgx.Row) (quoteRow, error) {
	var q quoteRow
	var lineItems, request []byte
	var consumed pgtype.Timestamptz
	err := row.Scan(&q.ID, &q.UserID, &q.WorkspaceID, &q.ConversationID, &q.Currency, &q.TotalCredits, &lineItems, &request, &q.Status, &q.ExpiresAt, &q.CreatedAt, &consumed, &q.IdempotencyKey)
	if err != nil {
		return q, err
	}
	_ = json.Unmarshal(lineItems, &q.LineItems)
	if q.LineItems == nil {
		q.LineItems = []LineItem{}
	}
	q.Request = request
	if consumed.Valid {
		t := consumed.Time
		q.ConsumedAt = &t
	}
	var snapshot Request
	_ = json.Unmarshal(request, &snapshot)
	q.RequestModel = snapshot.Model
	q.RequestMode = snapshot.Mode
	q.RequestPrompt = snapshot.Prompt
	q.RequestEditMode = snapshot.EditMode
	q.RequestSize = snapshot.Size
	q.RequestCount = snapshot.NumberOfImages
	q.RequestReferenceIDs = snapshot.ReferenceAssetIDs
	q.RequestMaskAssetID = snapshot.MaskAssetID
	return q, nil
}

type postgresStore struct{ pool *pgxpool.Pool }

func (s *postgresStore) Create(ctx context.Context, q Quote) (Quote, error) {
	line, _ := json.Marshal(q.LineItems)
	var created time.Time
	var id string
	err := s.pool.QueryRow(ctx, `INSERT INTO quotes(user_id,workspace_id,conversation_id,currency,total_credits,line_items,request,status,expires_at,idempotency_key) VALUES($1,nullif($2,'')::uuid,nullif($3,'')::uuid,$4,$5,$6,$7,'active',$8,$9) RETURNING id::text,created_at`, q.UserID, q.WorkspaceID, q.ConversationID, q.Currency, q.TotalCredits, line, q.Request, q.ExpiresAt, q.IdempotencyKey).Scan(&id, &created)
	if err != nil {
		return Quote{}, err
	}
	q.ID, q.CreatedAt = id, created
	return q, nil
}

func (s *postgresStore) Get(ctx context.Context, userID, id string) (Quote, error) {
	row, err := scanQuote(s.pool.QueryRow(ctx, `SELECT `+quoteCols+` FROM quotes WHERE id=$1 AND user_id=$2`, id, userID))
	if err != nil {
		return Quote{}, err
	}
	return row.Quote, nil
}

func (s *postgresStore) Consume(ctx context.Context, userID, id string) (Quote, error) {
	row, err := scanQuote(s.pool.QueryRow(ctx, `UPDATE quotes SET status='consumed',consumed_at=now() WHERE id=$1 AND user_id=$2 AND status='active' AND expires_at>now() RETURNING `+quoteCols, id, userID))
	if err != nil {
		return Quote{}, err
	}
	return row.Quote, nil
}
