//go:build integration

package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/commercial"
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/httpapi"
	"github.com/weavia/weavia/services/backend/internal/providers"
	"github.com/weavia/weavia/services/backend/internal/store"
)

type commercialMockProvider struct{ calls atomic.Int32 }

func (p *commercialMockProvider) Generate(_ context.Context, input providers.ImageRequest) (providers.ImageResult, error) {
	p.calls.Add(1)
	return providers.ImageResult{ProviderRequestID: "commercial-mock-1", Outputs: []providers.Output{{URI: "https://mock.invalid/generated-product.png", MediaType: "image/png"}}}, nil
}

// TestCommercialPostgresRiverE2E proves the complete Commercial V1 acceptance
// chain against PostgreSQL and River without contacting a paid AI provider.
func TestCommercialPostgresRiverE2E(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err = pool.Ping(ctx); err != nil {
		t.Fatal(err)
	}

	assertMigration(t, ctx, pool)
	_, _ = pool.Exec(ctx, "DELETE FROM river_job WHERE kind = 'generation'")

	commercialService := commercial.New(pool)
	repository := store.NewTaskRepository(pool)
	enqueueClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{})
	if err != nil {
		t.Fatal(err)
	}
	mock := &commercialMockProvider{}
	generationService := generation.NewService(true, mock, Enqueuer{Client: enqueueClient}, nil, repository).WithCredits(commercialService)
	server := &httpapi.Server{Auth: auth.NewService(pool, "http://localhost:3000"), Commercial: commercialService, Generation: generationService, Assets: assets.New(t.TempDir(), "integration-secret")}
	handler := server.Router()

	suffix := time.Now().UnixNano()
	email := fmt.Sprintf("commercial-%d@weavia.test", suffix)
	registered := apiCall(t, handler, http.MethodPost, "/api/auth/register", map[string]any{"email": email, "password": "Commercial-123!", "name": "Commercial CI", "deviceInfo": map[string]any{"deviceId": fmt.Sprintf("register-%d", suffix), "deviceName": "CI Register", "platform": "web"}}, "")["data"].(map[string]any)
	userID := registered["user"].(map[string]any)["id"].(string)
	loggedIn := apiCall(t, handler, http.MethodPost, "/api/auth/login", map[string]any{"email": email, "password": "Commercial-123!", "deviceInfo": map[string]any{"deviceId": fmt.Sprintf("login-%d", suffix), "deviceName": "CI Login", "platform": "web"}}, "")["data"].(map[string]any)
	token := loggedIn["accessToken"].(string)

	workspace := apiCall(t, handler, http.MethodPost, "/api/workspaces", map[string]any{"name": "Commercial Acceptance"}, token)["data"].(map[string]any)
	workspaceID := workspace["id"].(string)
	project := apiCall(t, handler, http.MethodPost, "/api/workspaces/"+workspaceID+"/projects", map[string]any{"name": "E2E Project", "description": "commercial acceptance"}, token)["data"].(map[string]any)
	projectID := project["id"].(string)
	product := apiCall(t, handler, http.MethodPost, "/api/projects/"+projectID+"/products", map[string]any{"workspaceId": workspaceID, "name": "E2E Product", "description": "real business chain"}, token)["data"].(map[string]any)
	productID := product["id"].(string)
	sku := apiCall(t, handler, http.MethodPost, "/api/products/"+productID+"/skus", map[string]any{"code": fmt.Sprintf("SKU-%d", suffix), "name": "Primary SKU", "attributes": map[string]any{"color": "black"}}, token)["data"].(map[string]any)
	skuID := sku["id"].(string)

	assetID := fmt.Sprintf("%08x-0000-4000-8000-%012x", uint32(suffix), uint64(suffix)&0xffffffffffff)
	presign := apiCall(t, handler, http.MethodPost, "/api/assets/presign", map[string]any{"assetId": assetID, "contentType": "image/png", "size": 3, "workspaceId": workspaceID, "projectId": projectID, "productId": productID, "skuId": skuID}, token)["data"].(map[string]any)
	uploadRequest := httptest.NewRequest(http.MethodPut, presign["uploadUrl"].(string), bytes.NewReader([]byte("png")))
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusNoContent {
		t.Fatalf("asset upload: %d %s", uploadResponse.Code, uploadResponse.Body.String())
	}

	idempotencyKey := fmt.Sprintf("commercial-e2e-%d", suffix)
	request := map[string]any{"idempotencyKey": idempotencyKey, "workspaceId": workspaceID, "projectId": projectID, "productId": productID, "skuId": skuID, "inputAssetId": assetID, "workflow": "product_image_generation", "logicalModel": "weavia-image-pro", "model": "qwen-image-2.0", "prompt": "commercial product photo", "mode": "image_to_image", "referenceAssets": []any{map[string]any{"assetId": assetID, "objectKey": presign["objectKey"], "mimeType": "image/png"}}, "size": "1024x1024", "quality": "standard", "numberOfImages": 1, "outputFormat": "png", "metadata": map[string]any{}}
	created := apiCall(t, handler, http.MethodPost, "/api/ai/tasks", request, token)["data"].(map[string]any)
	taskID := created["id"].(string)
	if created["status"] != "reserved" {
		t.Fatalf("initial task status = %v", created["status"])
	}
	duplicate := apiCall(t, handler, http.MethodPost, "/api/ai/tasks", request, token)["data"].(map[string]any)
	if duplicate["id"] != taskID {
		t.Fatalf("idempotency returned %v, want %s", duplicate["id"], taskID)
	}

	assertReserved(t, ctx, pool, userID, taskID)
	workerClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Queues: map[string]river.QueueConfig{Queue: {MaxWorkers: 1}}, Workers: Workers(generationService)})
	if err != nil {
		t.Fatal(err)
	}
	if err = workerClient.Start(ctx); err != nil {
		t.Fatal(err)
	}
	defer workerClient.Stop(context.Background())

	deadline := time.Now().Add(20 * time.Second)
	for {
		result := apiCall(t, handler, http.MethodGet, "/api/ai/tasks/"+taskID, nil, token)["data"].(map[string]any)
		if result["status"] == "success" {
			if result["providerRequestId"] != "commercial-mock-1" {
				t.Fatalf("result = %#v", result)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("task did not complete: %#v", result)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if mock.calls.Load() != 1 {
		t.Fatalf("provider calls=%d, want 1", mock.calls.Load())
	}
	assertSettledAndLinked(t, ctx, pool, userID, taskID, workspaceID, productID, skuID)
}

func assertMigration(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	var plans, entitlements int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM plans WHERE code=ANY($1)`, []string{"free", "pro", "studio", "agency"}).Scan(&plans); err != nil || plans != 4 {
		t.Fatalf("plans=%d err=%v", plans, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM entitlements e JOIN plans p ON p.id=e.plan_id WHERE p.code=ANY($1)`, []string{"free", "pro", "studio", "agency"}).Scan(&entitlements); err != nil || entitlements != 12 {
		t.Fatalf("entitlements=%d err=%v", entitlements, err)
	}
}
func assertReserved(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID, taskID string) {
	t.Helper()
	var available, reserved int64
	var status string
	if err := pool.QueryRow(ctx, `SELECT a.available_balance,a.reserved_balance,r.status FROM credit_accounts a JOIN credit_reservations r ON r.account_id=a.id WHERE a.user_id=$1 AND r.reference_id=$2`, userID, taskID).Scan(&available, &reserved, &status); err != nil || available != 40 || reserved != 10 || status != "reserved" {
		t.Fatalf("reserved ledger available=%d reserved=%d status=%s err=%v", available, reserved, status, err)
	}
}
func assertSettledAndLinked(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID, taskID, workspaceID, productID, skuID string) {
	t.Helper()
	var available, reserved int64
	var status string
	if err := pool.QueryRow(ctx, `SELECT a.available_balance,a.reserved_balance,r.status FROM credit_accounts a JOIN credit_reservations r ON r.account_id=a.id WHERE a.user_id=$1 AND r.reference_id=$2`, userID, taskID).Scan(&available, &reserved, &status); err != nil || available != 40 || reserved != 0 || status != "confirmed" {
		t.Fatalf("settled ledger available=%d reserved=%d status=%s err=%v", available, reserved, status, err)
	}
	var reserveCount, consumeCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FILTER(WHERE t.type='reserve'),count(*) FILTER(WHERE t.type='consume') FROM credit_transactions_v1 t JOIN credit_accounts a ON a.id=t.account_id WHERE a.user_id=$1 AND t.reference_id=$2`, userID, taskID).Scan(&reserveCount, &consumeCount); err != nil || reserveCount != 1 || consumeCount != 1 {
		t.Fatalf("ledger rows reserve=%d consume=%d err=%v", reserveCount, consumeCount, err)
	}
	var sourceCount, generatedCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FILTER(WHERE kind='source' AND upload_status='UPLOADED'),count(*) FILTER(WHERE kind='generated' AND asset_role='GENERATED_RESULT' AND task_id=$2) FROM assets WHERE user_id=$1 AND workspace_id=$3 AND product_id=$4 AND sku_id=$5`, userID, taskID, workspaceID, productID, skuID).Scan(&sourceCount, &generatedCount); err != nil || sourceCount != 1 || generatedCount != 1 {
		t.Fatalf("assets source=%d generated=%d err=%v", sourceCount, generatedCount, err)
	}
	var orphanCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM tasks t LEFT JOIN credit_reservations r ON r.id=t.credit_reservation_id WHERE t.id=$1 AND (r.id IS NULL OR t.workspace_id IS NULL OR t.product_id IS NULL OR t.sku_id IS NULL)`, taskID).Scan(&orphanCount); err != nil || orphanCount != 0 {
		t.Fatalf("task integrity orphans=%d err=%v", orphanCount, err)
	}
}

func apiCall(t *testing.T, handler http.Handler, method, path string, body any, token string) map[string]any {
	t.Helper()
	var encoded []byte
	if body != nil {
		encoded, _ = json.Marshal(body)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("%s %s: %d %s", method, path, response.Code, response.Body.String())
	}
	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}
