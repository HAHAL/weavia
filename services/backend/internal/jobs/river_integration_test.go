//go:build integration

package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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
	"github.com/weavia/weavia/services/backend/internal/generation"
	"github.com/weavia/weavia/services/backend/internal/httpapi"
	"github.com/weavia/weavia/services/backend/internal/providers"
	"github.com/weavia/weavia/services/backend/internal/store"
)

type retryingMockProvider struct{ calls atomic.Int32 }

func (p *retryingMockProvider) Generate(_ context.Context, _ providers.ImageRequest) (providers.ImageResult, error) {
	if p.calls.Add(1) == 1 {
		return providers.ImageResult{}, errors.New("intentional transient mock failure")
	}
	return providers.ImageResult{ProviderRequestID: "mock-request-1", Outputs: []providers.Output{{URI: "https://mock.invalid/result.png", MediaType: "image/png"}}}, nil
}

// TestPostgresRiverAPIFlow exercises the public Go API, PostgreSQL repository,
// durable River queue, retry, idempotency, and persisted result without making
// any real provider request. The API inserts while no worker is running, which
// also verifies recovery after the API/client process is gone.
func TestPostgresRiverAPIFlow(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err = pool.Ping(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, "DELETE FROM river_job WHERE kind = 'generation'; DELETE FROM tasks; DELETE FROM users WHERE id = '00000000-0000-4000-8000-000000000001'"); err != nil {
		t.Fatal(err)
	}

	repository := store.NewTaskRepository(pool)
	if err = repository.EnsureDemoUser(ctx); err != nil {
		t.Fatal(err)
	}
	enqueueClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{})
	if err != nil {
		t.Fatal(err)
	}
	mock := &retryingMockProvider{}
	service := generation.NewService(true, mock, Enqueuer{Client: enqueueClient}, nil, repository)
	server := &httpapi.Server{Auth: auth.NewService("http://localhost:3000"), Generation: service, Assets: assets.New(t.TempDir(), "integration-secret")}
	handler := server.Router()
	token := authenticate(t, handler)

	presign := apiCall(t, handler, http.MethodPost, "/api/assets/presign", map[string]any{"assetId": "asset-1", "contentType": "image/png", "size": 3}, token)
	uploadURL := presign["data"].(map[string]any)["uploadUrl"].(string)
	uploadRequest := httptest.NewRequest(http.MethodPut, uploadURL, bytes.NewReader([]byte("png")))
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusNoContent {
		t.Fatalf("asset upload: %d %s", uploadResponse.Code, uploadResponse.Body.String())
	}

	request := map[string]any{"idempotencyKey": "postgres-river-idem", "projectId": "project-1", "inputAssetId": "asset-1", "workflow": "product_image_generation", "logicalModel": "weavia-image-pro", "model": "qwen-image-2.0", "prompt": "mock product photo", "mode": "text_to_image", "referenceAssets": []any{}, "size": "1024x1024", "quality": "standard", "numberOfImages": 1, "outputFormat": "png", "metadata": map[string]any{}}
	created := apiCall(t, handler, http.MethodPost, "/api/ai/tasks", request, token)["data"].(map[string]any)
	taskID := created["id"].(string)
	duplicate := apiCall(t, handler, http.MethodPost, "/api/ai/tasks", request, token)["data"].(map[string]any)
	if duplicate["id"] != taskID {
		t.Fatalf("idempotency returned %v, want %s", duplicate["id"], taskID)
	}

	workerClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Queues: map[string]river.QueueConfig{Queue: {MaxWorkers: 1}}, Workers: Workers(service)})
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
		if result["status"] == "generated" {
			if result["providerRequestId"] != "mock-request-1" || len(result["outputs"].([]any)) != 1 {
				t.Fatalf("persisted result = %#v", result)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("task did not complete after retry: %#v", result)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if mock.calls.Load() != 2 {
		t.Fatalf("mock provider calls = %d, want retry total 2", mock.calls.Load())
	}

	// Read through a fresh repository instance to prove the result is in PostgreSQL.
	persisted, found, err := store.NewTaskRepository(pool).Get(ctx, taskID)
	if err != nil || !found || persisted.Status != "generated" || persisted.ProviderRequestID != "mock-request-1" {
		t.Fatalf("fresh repository read: task=%#v found=%v err=%v", persisted, found, err)
	}
}

func authenticate(t *testing.T, handler http.Handler) string {
	t.Helper()
	session := apiCall(t, handler, http.MethodPost, "/api/auth/desktop/session", map[string]any{"redirectUri": "weavia://auth/callback"}, "")["data"].(map[string]any)
	authorized := apiCall(t, handler, http.MethodPost, "/api/auth/desktop/authorize", map[string]any{"loginSessionId": session["loginSessionId"]}, "")["data"].(map[string]any)
	callbackRequest, _ := http.NewRequest(http.MethodGet, authorized["callbackUrl"].(string), nil)
	query := callbackRequest.URL.Query()
	exchanged := apiCall(t, handler, http.MethodPost, "/api/auth/desktop/exchange", map[string]any{"code": query.Get("code"), "state": query.Get("state"), "deviceInfo": map[string]any{"deviceId": "ci", "deviceName": "CI", "platform": "test", "osVersion": "1", "appVersion": "1"}}, "")["data"].(map[string]any)
	return exchanged["accessToken"].(string)
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
