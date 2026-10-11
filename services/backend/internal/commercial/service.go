package commercial

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrInsufficientCredits = errors.New("insufficient credits")

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Plan struct {
	ID              string         `json:"id"`
	Code            string         `json:"code"`
	Name            string         `json:"name"`
	BillingCycle    string         `json:"billingCycle"`
	PriceMinor      int            `json:"priceMinor"`
	IncludedCredits int64          `json:"includedCredits"`
	MaxDevices      int            `json:"maxDevices"`
	MaxConcurrency  int            `json:"maxConcurrency"`
	Entitlements    map[string]any `json:"entitlements"`
}
type Subscription struct {
	ID                 string         `json:"id"`
	Status             string         `json:"status"`
	CurrentPeriodStart time.Time      `json:"currentPeriodStart"`
	CurrentPeriodEnd   *time.Time     `json:"currentPeriodEnd,omitempty"`
	CancelAtPeriodEnd  bool           `json:"cancelAtPeriodEnd"`
	Plan               Plan           `json:"plan"`
	Entitlements       map[string]any `json:"entitlements"`
}
type CreditAccount struct {
	ID        string `json:"id"`
	Available int64  `json:"available"`
	Reserved  int64  `json:"reserved"`
	Currency  string `json:"currency"`
	Version   int64  `json:"version"`
}
type CreditTransaction struct {
	ID             string         `json:"id"`
	Type           string         `json:"type"`
	AvailableDelta int64          `json:"availableDelta"`
	ReservedDelta  int64          `json:"reservedDelta"`
	BalanceAfter   int64          `json:"balanceAfter"`
	ReservedAfter  int64          `json:"reservedAfter"`
	ReferenceType  string         `json:"referenceType"`
	ReferenceID    string         `json:"referenceId"`
	Metadata       map[string]any `json:"metadata"`
	CreatedAt      time.Time      `json:"createdAt"`
}
type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"createdAt"`
}
type Project struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspaceId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}
type Product struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspaceId"`
	ProjectID   string    `json:"projectId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}
type SKU struct {
	ID         string         `json:"id"`
	ProductID  string         `json:"productId"`
	Code       string         `json:"code"`
	Name       string         `json:"name"`
	Attributes map[string]any `json:"attributes"`
	CreatedAt  time.Time      `json:"createdAt"`
}
type Asset struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspaceId"`
	ProjectID   string    `json:"projectId"`
	ProductID   string    `json:"productId"`
	SKUID       string    `json:"skuId"`
	TaskID      *string   `json:"taskId,omitempty"`
	Kind        string    `json:"kind"`
	MimeType    string    `json:"mimeType"`
	Size        int64     `json:"size"`
	ObjectKey   *string   `json:"objectKey,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (s *Service) Plans(ctx context.Context) ([]Plan, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,code,name,billing_cycle,price_minor,included_credits,max_devices,max_concurrency,entitlements FROM plans WHERE enabled ORDER BY price_minor`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Plan{}
	for rows.Next() {
		var p Plan
		var raw []byte
		if err = rows.Scan(&p.ID, &p.Code, &p.Name, &p.BillingCycle, &p.PriceMinor, &p.IncludedCredits, &p.MaxDevices, &p.MaxConcurrency, &raw); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &p.Entitlements)
		out = append(out, p)
	}
	return out, rows.Err()
}
func (s *Service) Subscription(ctx context.Context, userID string) (Subscription, error) {
	_, _ = s.pool.Exec(ctx, `UPDATE subscriptions SET status='expired',updated_at=now() WHERE user_id=$1 AND status IN('trialing','active') AND current_period_end IS NOT NULL AND current_period_end<=now()`, userID)
	var v Subscription
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT s.id::text,s.status,s.current_period_start,s.current_period_end,s.cancel_at_period_end,p.id::text,p.code,p.name,p.billing_cycle,p.price_minor,p.included_credits,p.max_devices,p.max_concurrency,coalesce(jsonb_object_agg(e.key,e.value) FILTER(WHERE e.key IS NOT NULL),'{}') FROM subscriptions s JOIN plans p ON p.id=s.plan_id LEFT JOIN entitlements e ON e.plan_id=p.id WHERE s.user_id=$1 GROUP BY s.id,p.id ORDER BY (s.status IN('trialing','active')) DESC,s.created_at DESC LIMIT 1`, userID).Scan(&v.ID, &v.Status, &v.CurrentPeriodStart, &v.CurrentPeriodEnd, &v.CancelAtPeriodEnd, &v.Plan.ID, &v.Plan.Code, &v.Plan.Name, &v.Plan.BillingCycle, &v.Plan.PriceMinor, &v.Plan.IncludedCredits, &v.Plan.MaxDevices, &v.Plan.MaxConcurrency, &raw)
	if err != nil {
		return v, err
	}
	_ = json.Unmarshal(raw, &v.Entitlements)
	v.Plan.Entitlements = v.Entitlements
	return v, nil
}
func (s *Service) CreditAccount(ctx context.Context, userID string) (CreditAccount, error) {
	var a CreditAccount
	err := s.pool.QueryRow(ctx, `SELECT id::text,available_balance,reserved_balance,currency,version FROM credit_accounts WHERE user_id=$1 AND currency='credits'`, userID).Scan(&a.ID, &a.Available, &a.Reserved, &a.Currency, &a.Version)
	return a, err
}
func (s *Service) CreditTransactions(ctx context.Context, userID string, limit int) ([]CreditTransaction, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `SELECT t.id::text,t.type,t.available_delta,t.reserved_delta,t.balance_after,t.reserved_after,t.reference_type,t.reference_id,t.metadata,t.created_at FROM credit_transactions_v1 t JOIN credit_accounts a ON a.id=t.account_id WHERE a.user_id=$1 ORDER BY t.created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CreditTransaction{}
	for rows.Next() {
		var t CreditTransaction
		var raw []byte
		if err = rows.Scan(&t.ID, &t.Type, &t.AvailableDelta, &t.ReservedDelta, &t.BalanceAfter, &t.ReservedAfter, &t.ReferenceType, &t.ReferenceID, &raw, &t.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &t.Metadata)
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Service) Reserve(ctx context.Context, userID, referenceID, idempotencyKey string, amount int64) (string, error) {
	if amount <= 0 {
		return "", fmt.Errorf("invalid reservation amount")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var existing, status string
	err = tx.QueryRow(ctx, `SELECT r.id::text,r.status FROM credit_reservations r JOIN credit_accounts a ON a.id=r.account_id WHERE a.user_id=$1 AND r.idempotency_key=$2`, userID, idempotencyKey).Scan(&existing, &status)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	var accountID string
	var available, reserved int64
	err = tx.QueryRow(ctx, `SELECT id::text,available_balance,reserved_balance FROM credit_accounts WHERE user_id=$1 AND currency='credits' FOR UPDATE`, userID).Scan(&accountID, &available, &reserved)
	if err != nil {
		return "", err
	}
	err = tx.QueryRow(ctx, `SELECT id::text FROM credit_reservations WHERE account_id=$1 AND idempotency_key=$2`, accountID, idempotencyKey).Scan(&existing)
	if err == nil {
		return existing, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if available < amount {
		return "", ErrInsufficientCredits
	}
	reservationID := newID()
	available -= amount
	reserved += amount
	_, err = tx.Exec(ctx, `UPDATE credit_accounts SET available_balance=$2,reserved_balance=$3,version=version+1,updated_at=now() WHERE id=$1`, accountID, available, reserved)
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `INSERT INTO credit_reservations(id,account_id,amount,reference_type,reference_id,idempotency_key,expires_at) VALUES($1,$2,$3,'generation_task',$4,$5,now()+interval '30 minutes')`, reservationID, accountID, amount, referenceID, idempotencyKey)
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `INSERT INTO credit_transactions_v1(account_id,reservation_id,type,available_delta,reserved_delta,balance_after,reserved_after,reference_type,reference_id,idempotency_key,actor_user_id) VALUES($1,$2,'reserve',$3,$4,$5,$6,'generation_task',$7,$8,$9)`, accountID, reservationID, -amount, amount, available, reserved, referenceID, idempotencyKey+":reserve", userID)
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,after) VALUES($1,'credits.reserved','credit_reservation',$2,jsonb_build_object('amount',$3::bigint))`, userID, reservationID, amount)
	if err != nil {
		return "", err
	}
	return reservationID, tx.Commit(ctx)
}
func (s *Service) Confirm(ctx context.Context, reservationID string) error {
	return s.settle(ctx, reservationID, true)
}
func (s *Service) Release(ctx context.Context, reservationID string) error {
	return s.settle(ctx, reservationID, false)
}
func (s *Service) settle(ctx context.Context, reservationID string, confirm bool) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var accountID, userID, referenceID, status string
	var amount, available, reserved int64
	err = tx.QueryRow(ctx, `SELECT r.account_id::text,a.user_id::text,r.reference_id,r.status,r.amount,a.available_balance,a.reserved_balance FROM credit_reservations r JOIN credit_accounts a ON a.id=r.account_id WHERE r.id=$1 FOR UPDATE OF r,a`, reservationID).Scan(&accountID, &userID, &referenceID, &status, &amount, &available, &reserved)
	if err != nil {
		return err
	}
	if status != "reserved" {
		return nil
	}
	if confirm {
		var ready bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assets WHERE task_id=$1 AND user_id=$2 AND kind='generated' AND upload_status='UPLOADED' AND size>0 AND object_key LIKE 'generated/' || $1::text || '/%')`, referenceID, userID).Scan(&ready)
		if err != nil {
			return err
		}
		if !ready {
			return fmt.Errorf("generated asset is not durable")
		}
	}
	kind, action, availableDelta, reservedDelta := "consume", "credits.consumed", int64(0), -amount
	nextStatus, timeColumn := "confirmed", "confirmed_at"
	if !confirm {
		kind, action = "release", "credits.released"
		availableDelta = amount
		nextStatus, timeColumn = "released", "released_at"
	}
	available += availableDelta
	reserved += reservedDelta
	_, err = tx.Exec(ctx, `UPDATE credit_accounts SET available_balance=$2,reserved_balance=$3,version=version+1,updated_at=now() WHERE id=$1`, accountID, available, reserved)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE credit_reservations SET status=$2,updated_at=now(),`+timeColumn+`=now() WHERE id=$1`, reservationID, nextStatus)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO credit_transactions_v1(account_id,reservation_id,type,available_delta,reserved_delta,balance_after,reserved_after,reference_type,reference_id,idempotency_key,actor_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,'generation_task',$8,$9,$10)`, accountID, reservationID, kind, availableDelta, reservedDelta, available, reserved, referenceID, reservationID+":"+kind, userID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,after) VALUES($1,$2,'credit_reservation',$3,jsonb_build_object('amount',$4::bigint))`, userID, action, reservationID, amount)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Service) Adjust(ctx context.Context, actorID, userID string, amount int64, reason, idempotencyKey, ip string) (CreditAccount, error) {
	if amount == 0 {
		return CreditAccount{}, fmt.Errorf("amount must not be zero")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CreditAccount{}, err
	}
	defer tx.Rollback(ctx)
	var a CreditAccount
	err = tx.QueryRow(ctx, `SELECT id::text,available_balance,reserved_balance,currency,version FROM credit_accounts WHERE user_id=$1 FOR UPDATE`, userID).Scan(&a.ID, &a.Available, &a.Reserved, &a.Currency, &a.Version)
	if err != nil {
		return a, err
	}
	var existingAmount int64
	err = tx.QueryRow(ctx, `SELECT available_delta FROM credit_transactions_v1 WHERE idempotency_key=$1 AND account_id=$2`, idempotencyKey, a.ID).Scan(&existingAmount)
	if err == nil {
		if existingAmount != amount {
			return a, fmt.Errorf("idempotency key used with a different amount")
		}
		return a, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return a, err
	}
	if a.Available+amount < 0 {
		return a, ErrInsufficientCredits
	}
	a.Available += amount
	a.Version++
	_, err = tx.Exec(ctx, `UPDATE credit_accounts SET available_balance=$2,version=$3,updated_at=now() WHERE id=$1`, a.ID, a.Available, a.Version)
	if err != nil {
		return a, err
	}
	kind := "admin_adjustment"
	if amount > 0 && actorID == userID {
		kind = "topup"
	}
	_, err = tx.Exec(ctx, `INSERT INTO credit_transactions_v1(account_id,type,available_delta,reserved_delta,balance_after,reserved_after,reference_type,reference_id,idempotency_key,actor_user_id,metadata) VALUES($1,$2,$3,0,$4,$5,'manual',$6,$7,$8,jsonb_build_object('reason',$9::text))`, a.ID, kind, amount, a.Available, a.Reserved, userID, idempotencyKey, actorID, reason)
	if err != nil {
		return a, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,after,metadata) VALUES($1,'credits.adjusted','credit_account',$2,jsonb_build_object('amount',$3::bigint),jsonb_build_object('reason',$4::text))`, actorID, a.ID, amount, reason)
	if err != nil {
		return a, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO admin_audit_logs(actor_user_id,action,resource_type,resource_id,ip,before,after) VALUES($1,'credits.adjust','credit_account',$2,nullif($3::text,'')::inet,jsonb_build_object('available',$4::bigint),jsonb_build_object('available',$5::bigint,'amount',$6::bigint,'reason',$7::text))`, actorID, a.ID, ip, a.Available-amount, a.Available, amount, reason)
	if err != nil {
		return a, err
	}
	return a, tx.Commit(ctx)
}

func (s *Service) AdminSetUserStatus(ctx context.Context, actorID, targetID, status, ip string) error {
	if status != "active" && status != "disabled" {
		return fmt.Errorf("invalid user status")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var previous string
	err = tx.QueryRow(ctx, `SELECT status FROM users WHERE id=$1 FOR UPDATE`, targetID).Scan(&previous)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE users SET status=$2,updated_at=now() WHERE id=$1`, targetID, status)
	if err != nil {
		return err
	}
	if status == "disabled" {
		_, err = tx.Exec(ctx, `UPDATE sessions SET revoked_at=now(),updated_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, targetID)
		if err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `INSERT INTO admin_audit_logs(actor_user_id,action,resource_type,resource_id,ip,before,after) VALUES($1,'user.status','user',$2,nullif($3::text,'')::inet,jsonb_build_object('status',$4::text),jsonb_build_object('status',$5::text))`, actorID, targetID, ip, previous, status)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) AdminUpdatePlan(ctx context.Context, actorID, planID string, priceMinor int, enabled bool, ip string) error {
	if priceMinor < 0 {
		return fmt.Errorf("invalid price")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var previousPrice int
	var previousEnabled bool
	err = tx.QueryRow(ctx, `SELECT price_minor,enabled FROM plans WHERE id=$1 FOR UPDATE`, planID).Scan(&previousPrice, &previousEnabled)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE plans SET price_minor=$2,enabled=$3,updated_at=now() WHERE id=$1`, planID, priceMinor, enabled)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO admin_audit_logs(actor_user_id,action,resource_type,resource_id,ip,before,after) VALUES($1,'plan.update','plan',$2,nullif($3::text,'')::inet,jsonb_build_object('priceMinor',$4::integer,'enabled',$5::boolean),jsonb_build_object('priceMinor',$6::integer,'enabled',$7::boolean))`, actorID, planID, ip, previousPrice, previousEnabled, priceMinor, enabled)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) CreateWorkspace(ctx context.Context, userID, name string) (Workspace, error) {
	var w Workspace
	slug := strings.Trim(strings.ToLower(strings.ReplaceAll(name, " ", "-")), "-") + "-" + strings.ReplaceAll(newID()[0:8], "-", "")
	err := s.pool.QueryRow(ctx, `WITH created AS (INSERT INTO workspaces(owner_user_id,name,slug) VALUES($1,$2,$3) RETURNING id,name,slug,created_at), member AS (INSERT INTO workspace_members(workspace_id,user_id,role) SELECT id,$1,'owner' FROM created) SELECT id::text,name,slug,created_at FROM created`, userID, name, slug).Scan(&w.ID, &w.Name, &w.Slug, &w.CreatedAt)
	return w, err
}
func (s *Service) ListWorkspaces(ctx context.Context, userID string) ([]Workspace, error) {
	rows, err := s.pool.Query(ctx, `SELECT w.id::text,w.name,w.slug,w.created_at FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Workspace{}
	for rows.Next() {
		var w Workspace
		if err = rows.Scan(&w.ID, &w.Name, &w.Slug, &w.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}
func (s *Service) CreateProject(ctx context.Context, userID, workspaceID, name, description string) (Project, error) {
	var p Project
	err := s.pool.QueryRow(ctx, `INSERT INTO projects(workspace_id,name,description) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$4) RETURNING id::text,workspace_id::text,name,coalesce(description,''),created_at`, workspaceID, name, description, userID).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Description, &p.CreatedAt)
	return p, err
}
func (s *Service) CreateProduct(ctx context.Context, userID, workspaceID, projectID, name, description string) (Product, error) {
	var p Product
	err := s.pool.QueryRow(ctx, `INSERT INTO products(workspace_id,project_id,name,description,price_minor,currency,metadata) SELECT $1,$2,$3,$4,0,'CNY','{}' WHERE EXISTS(SELECT 1 FROM workspace_members wm JOIN projects project ON project.workspace_id=wm.workspace_id WHERE wm.workspace_id=$1 AND wm.user_id=$5 AND project.id=$2) RETURNING id::text,workspace_id::text,project_id::text,name,coalesce(description,''),created_at`, workspaceID, projectID, name, description, userID).Scan(&p.ID, &p.WorkspaceID, &p.ProjectID, &p.Name, &p.Description, &p.CreatedAt)
	return p, err
}
func (s *Service) CreateSKU(ctx context.Context, userID, productID, code, name string, attributes map[string]any) (SKU, error) {
	raw, _ := json.Marshal(attributes)
	var sku SKU
	var attr []byte
	err := s.pool.QueryRow(ctx, `INSERT INTO skus(product_id,code,name,attributes) SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM products p JOIN workspace_members m ON m.workspace_id=p.workspace_id WHERE p.id=$1 AND m.user_id=$5) RETURNING id::text,product_id::text,code,name,attributes,created_at`, productID, code, name, raw, userID).Scan(&sku.ID, &sku.ProductID, &sku.Code, &sku.Name, &attr, &sku.CreatedAt)
	_ = json.Unmarshal(attr, &sku.Attributes)
	return sku, err
}
func (s *Service) CreateAsset(ctx context.Context, userID string, a Asset) (Asset, error) {
	err := s.pool.QueryRow(ctx, `INSERT INTO assets(id,user_id,project_id,workspace_id,product_id,sku_id,asset_role,upload_status,mime_type,size,object_key,kind,metadata) SELECT $1,$2,$3,$4,$5,$6,'INPUT','PENDING',$7,$8,$9,$10,'{}' WHERE EXISTS(SELECT 1 FROM workspace_members wm JOIN projects p ON p.workspace_id=wm.workspace_id JOIN products pr ON pr.project_id=p.id JOIN skus sku ON sku.product_id=pr.id WHERE wm.workspace_id=$4 AND wm.user_id=$2 AND p.id::text=$3 AND pr.id=$5 AND sku.id=$6) RETURNING id::text,workspace_id::text,project_id,product_id::text,sku_id::text,task_id::text,kind,mime_type,size,object_key,created_at`, a.ID, userID, a.ProjectID, a.WorkspaceID, a.ProductID, a.SKUID, a.MimeType, a.Size, a.ObjectKey, a.Kind).Scan(&a.ID, &a.WorkspaceID, &a.ProjectID, &a.ProductID, &a.SKUID, &a.TaskID, &a.Kind, &a.MimeType, &a.Size, &a.ObjectKey, &a.CreatedAt)
	return a, err
}
func (s *Service) CanGenerate(ctx context.Context, userID, workspaceID, projectID, productID, skuID, assetID, objectKey string) (bool, error) {
	var allowed bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assets a JOIN skus sku ON sku.id=a.sku_id JOIN products pr ON pr.id=sku.product_id JOIN projects p ON p.id=pr.project_id JOIN workspace_members wm ON wm.workspace_id=p.workspace_id WHERE a.id=$1 AND a.user_id=$2 AND a.upload_status='UPLOADED' AND a.object_key=$3 AND a.workspace_id=$4 AND a.product_id=$5 AND a.sku_id=$6 AND a.project_id=$7 AND wm.user_id=$2)`, assetID, userID, objectKey, workspaceID, productID, skuID, projectID).Scan(&allowed)
	return allowed, err
}
func (s *Service) MarkAssetUploaded(ctx context.Context, objectKey string) error {
	_, err := s.pool.Exec(ctx, `UPDATE assets SET upload_status='UPLOADED',updated_at=now() WHERE object_key=$1`, objectKey)
	return err
}
func (s *Service) RecordGeneratedAsset(ctx context.Context, userID, workspaceID, projectID, productID, skuID, taskID, objectKey, mimeType string, size int64) error {
	if !strings.HasPrefix(objectKey, "generated/"+taskID+"/") || size <= 0 {
		return fmt.Errorf("generated asset is not durable")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, taskID)
	if err != nil {
		return err
	}
	var exists bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assets WHERE task_id=$1 AND kind='generated')`, taskID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		_, err = tx.Exec(ctx, `INSERT INTO assets(id,user_id,project_id,workspace_id,product_id,sku_id,task_id,asset_role,upload_status,mime_type,size,object_key,kind,metadata) VALUES($1,$2,$3,nullif($4::text,'')::uuid,nullif($5::text,'')::uuid,nullif($6::text,'')::uuid,$7,'GENERATED_RESULT','UPLOADED',$8,$9,$10,'generated','{}')`, newID(), userID, projectID, workspaceID, productID, skuID, taskID, mimeType, size, objectKey)
		if err != nil {
			return err
		}
	} else {
		_, err = tx.Exec(ctx, `UPDATE assets SET object_key=$3,mime_type=$4,size=$5,metadata='{}',upload_status='UPLOADED',updated_at=now() WHERE task_id=$1 AND user_id=$2 AND kind='generated'`, taskID, userID, objectKey, mimeType, size)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
func (s *Service) ListSKUAssets(ctx context.Context, userID, skuID string) ([]Asset, error) {
	rows, err := s.pool.Query(ctx, `SELECT a.id::text,a.workspace_id::text,a.project_id,a.product_id::text,a.sku_id::text,a.task_id::text,a.kind,a.mime_type,a.size,a.object_key,a.created_at FROM assets a JOIN workspace_members m ON m.workspace_id=a.workspace_id WHERE a.sku_id=$1 AND m.user_id=$2 ORDER BY a.created_at DESC`, skuID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Asset{}
	for rows.Next() {
		var a Asset
		if err = rows.Scan(&a.ID, &a.WorkspaceID, &a.ProjectID, &a.ProductID, &a.SKUID, &a.TaskID, &a.Kind, &a.MimeType, &a.Size, &a.ObjectKey, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Service) AdminUsers(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `SELECT u.id::text,u.email,coalesce(u.name,''),u.status,coalesce(p.code,'free'),coalesce(c.available_balance,0),u.created_at FROM users u LEFT JOIN LATERAL(SELECT plan_id FROM subscriptions WHERE user_id=u.id ORDER BY (status IN('active','trialing')) DESC,created_at DESC LIMIT 1)s ON true LEFT JOIN plans p ON p.id=s.plan_id LEFT JOIN credit_accounts c ON c.user_id=u.id ORDER BY u.created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, email, name, status, plan string
		var balance int64
		var created time.Time
		if err = rows.Scan(&id, &email, &name, &status, &plan, &balance, &created); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "email": email, "name": name, "status": status, "plan": plan, "credits": balance, "createdAt": created})
	}
	return out, rows.Err()
}
func (s *Service) AdminCreditTransactions(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `SELECT t.id::text,a.user_id::text,t.type,t.available_delta,t.reserved_delta,t.balance_after,t.reference_type,t.reference_id,t.created_at FROM credit_transactions_v1 t JOIN credit_accounts a ON a.id=t.account_id ORDER BY t.created_at DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, userID, kind, refType, refID string
		var ad, rd, balance int64
		var created time.Time
		if err = rows.Scan(&id, &userID, &kind, &ad, &rd, &balance, &refType, &refID, &created); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "userId": userID, "type": kind, "availableDelta": ad, "reservedDelta": rd, "balanceAfter": balance, "referenceType": refType, "referenceId": refID, "createdAt": created})
	}
	return out, rows.Err()
}
func (s *Service) AdminTasks(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,user_id::text,status,coalesce(provider,''),coalesce(model,''),cost,workspace_id::text,product_id::text,sku_id::text,created_at FROM tasks ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, userID, status, provider, model string
		var cost int64
		var workspaceID, productID, skuID *string
		var created time.Time
		if err = rows.Scan(&id, &userID, &status, &provider, &model, &cost, &workspaceID, &productID, &skuID, &created); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "userId": userID, "status": status, "provider": provider, "model": model, "cost": cost, "workspaceId": workspaceID, "productId": productID, "skuId": skuID, "createdAt": created})
	}
	return out, rows.Err()
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
}
