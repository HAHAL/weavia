package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type testAuth struct {
	access string
	demo   bool
	admin  bool
}

func (a *testAuth) Register(context.Context, string, string, string, auth.DeviceInfo) (auth.SessionResult, error) {
	return auth.SessionResult{}, nil
}
func (a *testAuth) Login(context.Context, string, string, auth.DeviceInfo) (auth.SessionResult, error) {
	return auth.SessionResult{}, nil
}
func (a *testAuth) CreateDesktopSession(context.Context, string) (map[string]any, error) {
	return map[string]any{"loginSessionId": "login", "state": "state", "loginUrl": "http://example.test", "expiresAt": "2099-01-01T00:00:00Z"}, nil
}
func (a *testAuth) Authorize(_ context.Context, _ string, userID string) (map[string]string, error) {
	if userID == "" && !a.demo {
		return nil, &auth.Error{Code: "INVALID_TOKEN", Message: "login required", Status: 401}
	}
	return map[string]string{"callbackUrl": "weavia://auth/callback?code=code&state=state"}, nil
}
func (a *testAuth) Exchange(context.Context, string, string, auth.DeviceInfo) (auth.SessionResult, error) {
	a.access = "access"
	return auth.SessionResult{AccessToken: a.access, User: auth.User{ID: auth.DemoUserID, Email: "demo@weavia.local", Status: "active"}}, nil
}
func (a *testAuth) Refresh(context.Context, string) (auth.SessionResult, error) {
	return auth.SessionResult{}, nil
}
func (a *testAuth) Logout(context.Context, string) error { return nil }
func (a *testAuth) Me(_ context.Context, value string) (auth.User, error) {
	if value != a.access {
		return auth.User{}, &auth.Error{Code: "INVALID_TOKEN", Message: "invalid", Status: 401}
	}
	return auth.User{ID: auth.DemoUserID, Email: "demo@weavia.local", Status: "active"}, nil
}
func (a *testAuth) ListDevices(context.Context, string) ([]auth.Device, error) {
	return []auth.Device{}, nil
}
func (a *testAuth) RevokeDevice(context.Context, string, string) error          { return nil }
func (a *testAuth) HasPermission(context.Context, string, string) (bool, error) { return a.admin, nil }
func (a *testAuth) AuditAdmin(context.Context, string, string, string, string, string, any, any) error {
	return nil
}
func (a *testAuth) ProviderStatuses(context.Context) (map[string]auth.ProviderStatus, error) {
	return map[string]auth.ProviderStatus{"antdigital": {ID: "00000000-0000-4000-8000-000000000101", Enabled: true}, "dashscope": {ID: "00000000-0000-4000-8000-000000000105", Enabled: true}}, nil
}
func (a *testAuth) SetProviderEnabled(context.Context, string, string, bool, string) error {
	return nil
}

func TestCatalogEstimateAndTemplatesCompatibility(t *testing.T) {
	authService := &testAuth{demo: true, admin: true}
	server := &Server{Auth: authService, Generation: generation.NewService(false, nil, nil, nil, nil), Assets: assets.New(t.TempDir(), "secret")}
	handler := server.Router()
	session := call(t, handler, "POST", "/api/auth/desktop/session", map[string]any{"redirectUri": "weavia://auth/callback"}, "")
	loginID := session["data"].(map[string]any)["loginSessionId"].(string)
	authorized := call(t, handler, "POST", "/api/auth/desktop/authorize", map[string]any{"loginSessionId": loginID}, "")
	callback := authorized["data"].(map[string]any)["callbackUrl"].(string)
	requestURL, _ := http.NewRequest("GET", callback, nil)
	query := requestURL.URL.Query()
	exchanged := call(t, handler, "POST", "/api/auth/desktop/exchange", map[string]any{"code": query.Get("code"), "state": query.Get("state"), "deviceInfo": map[string]any{"deviceId": "device", "deviceName": "Test", "platform": "test", "osVersion": "1", "appVersion": "1"}}, "")
	token := exchanged["data"].(map[string]any)["accessToken"].(string)
	catalog := call(t, handler, "GET", "/api/ai/catalog", nil, token)
	models := catalog["data"].(map[string]any)["models"].([]any)
	found := false
	for _, raw := range models {
		model := raw.(map[string]any)
		if model["id"] == "qwen-image-2.0" && model["creditsCost"] == float64(10) {
			found = true
		}
	}
	if !found {
		t.Fatalf("catalog = %#v", catalog)
	}
	estimate := call(t, handler, "POST", "/api/ai/estimate", map[string]any{"workflow": "product_image_generation", "model": "qwen-image-2.0", "imageCount": 1, "advancedSelection": false}, token)
	if estimate["data"].(map[string]any)["estimatedTime"] != float64(30) {
		t.Fatalf("estimate = %#v", estimate)
	}
	templates := call(t, handler, "GET", "/api/ai/templates", nil, token)
	if len(templates["data"].([]any)) != 3 {
		t.Fatalf("templates = %#v", templates)
	}
	admin := call(t, handler, "GET", "/api/admin/ai/catalog", nil, token)
	snapshot := admin["data"].(map[string]any)
	if len(snapshot["models"].([]any)) != 3 || len(snapshot["bindings"].([]any)) != 3 {
		t.Fatalf("admin catalog = %#v", snapshot)
	}
	encoded, _ := json.Marshal(snapshot)
	if bytes.Contains(encoded, []byte("APIKey")) || bytes.Contains(encoded, []byte("secret")) {
		t.Fatalf("admin catalog exposed a credential: %s", encoded)
	}
}

func TestProductionRejectsAnonymousDesktopAuthorizationAndAdmin(t *testing.T) {
	authService := &testAuth{access: "valid"}
	handler := (&Server{Auth: authService, Generation: generation.NewService(false, nil, nil, nil, nil), Assets: assets.New(t.TempDir(), "secret")}).Router()
	for _, test := range []struct {
		method, path string
		body         any
		token        string
		want         int
	}{
		{"POST", "/api/auth/desktop/authorize", map[string]string{"loginSessionId": "login"}, "", 401},
		{"GET", "/api/admin/ai/catalog", nil, "", 401},
		{"GET", "/api/admin/overview", nil, "", 401},
		{"GET", "/api/admin/orders", nil, "", 401},
		{"GET", "/api/admin/payments", nil, "", 401},
		{"GET", "/api/admin/devices", nil, "", 401},
		{"GET", "/api/admin/plans", nil, "", 401},
		{"GET", "/api/admin/task-runs", nil, "", 401},
		{"GET", "/api/admin/ops/status", nil, "", 401},
		{"GET", "/api/admin/tasks/00000000-0000-4000-8000-000000000001", nil, "", 401},
		{"GET", "/api/auth/sessions", nil, "", 401},
		{"POST", "/api/auth/sessions/revoke-all", nil, "", 401},
		{"POST", "/api/me/deletion-requests", map[string]string{"reason": "test"}, "", 401},
		{"GET", "/api/admin/users/deletion-requests", nil, "", 401},
		{"POST", "/api/admin/users/deletion-requests/00000000-0000-4000-8000-000000000001/approve", map[string]string{"reason": "test"}, "valid", 403},
		{"GET", "/api/projects", nil, "", 401},
		{"GET", "/api/assets", nil, "", 401},
		{"GET", "/api/assets/00000000-0000-4000-8000-000000000001/preview", nil, "", 401},
		{"GET", "/api/admin/ai/catalog", nil, "valid", 403},
		{"GET", "/api/admin/overview", nil, "valid", 403},
		{"GET", "/api/admin/orders", nil, "valid", 403},
		{"GET", "/api/admin/payments", nil, "valid", 403},
		{"GET", "/api/admin/devices", nil, "valid", 403},
		{"GET", "/api/admin/plans", nil, "valid", 403},
		{"GET", "/api/admin/task-runs", nil, "valid", 403},
		{"GET", "/api/admin/ops/status", nil, "valid", 403},
		{"GET", "/api/admin/tasks/00000000-0000-4000-8000-000000000001", nil, "valid", 403},
		{"PATCH", "/api/admin/ai/providers/00000000-0000-4000-8000-000000000101", map[string]bool{"enabled": true}, "valid", 403},
	} {
		encoded, _ := json.Marshal(test.body)
		request := httptest.NewRequest(test.method, test.path, bytes.NewReader(encoded))
		if test.token != "" {
			request.Header.Set("Authorization", "Bearer "+test.token)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != test.want {
			t.Fatalf("%s %s: got %d, want %d", test.method, test.path, response.Code, test.want)
		}
	}
}

func TestReadinessReflectsDependencyFailure(t *testing.T) {
	handler := (&Server{Readiness: map[string]func(context.Context) error{
		"database": func(context.Context) error { return nil },
		"queue":    func(context.Context) error { return &auth.Error{Code: "DOWN", Message: "down", Status: 503} },
		"storage":  func(context.Context) error { return nil },
	}}).Router()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/readiness", nil))
	if response.Code != 503 {
		t.Fatalf("readiness=%d, want 503", response.Code)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"queue":"failed"`)) {
		t.Fatalf("body=%s", response.Body.String())
	}
}

func TestHealthAndReadinessSuccess(t *testing.T) {
	handler := (&Server{Readiness: map[string]func(context.Context) error{
		"database": func(context.Context) error { return nil },
		"queue":    func(context.Context) error { return nil },
		"storage":  func(context.Context) error { return nil },
	}}).Router()
	for _, test := range []struct {
		path, body string
	}{
		{"/api/health", `"status":"ok"`},
		{"/api/readiness", `"status":"ready"`},
	} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, test.path, nil))
		if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(test.body)) {
			t.Fatalf("%s: %d %s", test.path, response.Code, response.Body.String())
		}
	}
}

func call(t *testing.T, handler http.Handler, method, path string, body any, token string) map[string]any {
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
	if response.Code != 200 {
		t.Fatalf("%s %s: %d %s", method, path, response.Code, response.Body.String())
	}
	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}
