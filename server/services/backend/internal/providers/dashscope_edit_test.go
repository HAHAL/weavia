package providers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestDashScopeImageEditMaskFlow(t *testing.T) {
	polls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/services/aigc/image2image/image-synthesis" && r.Method == http.MethodPost:
			if r.Header.Get("X-DashScope-Async") != "enable" {
				t.Errorf("missing async header")
			}
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			input, _ := body["input"].(map[string]any)
			if input["function"] != "description_edit_with_mask" || input["mask_image_url"] == "" {
				t.Errorf("unexpected input: %#v", input)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"output": map[string]any{"task_id": "t1", "task_status": "PENDING"}})
		case strings.HasPrefix(r.URL.Path, "/tasks/t1") && r.Method == http.MethodGet:
			polls++
			if polls < 2 {
				_ = json.NewEncoder(w).Encode(map[string]any{"output": map[string]any{"task_id": "t1", "task_status": "RUNNING"}})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"output": map[string]any{"task_id": "t1", "task_status": "SUCCEEDED", "results": []map[string]string{{"url": "https://example.test/result.png"}}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	p := &DashScopeImageEdit{BaseURL: server.URL, APIKey: "test", PollInterval: time.Millisecond, Timeout: 2 * time.Second}
	result, err := p.Generate(context.Background(), ImageRequest{
		Model: "wanx2.1-imageedit", Prompt: "replace the background",
		ReferenceImage: "data:image/png;base64,AAA", MaskImage: "data:image/png;base64,BBB",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Outputs) != 1 || result.Outputs[0].URI != "https://example.test/result.png" {
		t.Fatalf("unexpected result: %#v", result)
	}
	if polls < 2 {
		t.Fatalf("expected polling, got %d", polls)
	}
}
