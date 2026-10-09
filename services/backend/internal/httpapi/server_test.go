package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/weavia/weavia/services/backend/internal/assets"
	"github.com/weavia/weavia/services/backend/internal/auth"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

func TestCatalogEstimateAndTemplatesCompatibility(t *testing.T) {
	authService := auth.NewService("http://localhost:3000")
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
	admin := call(t, handler, "GET", "/api/admin/ai/catalog", nil, "")
	snapshot := admin["data"].(map[string]any)
	if len(snapshot["models"].([]any)) != 3 || len(snapshot["bindings"].([]any)) != 3 {
		t.Fatalf("admin catalog = %#v", snapshot)
	}
	encoded, _ := json.Marshal(snapshot)
	if bytes.Contains(encoded, []byte("APIKey")) || bytes.Contains(encoded, []byte("secret")) {
		t.Fatalf("admin catalog exposed a credential: %s", encoded)
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
