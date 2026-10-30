package providers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func fakeImageServer(t *testing.T, check func(r *http.Request, body []byte)) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		check(r, body)
		_, _ = w.Write([]byte(`{"data":[{"b64_json":"aGVsbG8="}]}`))
	}))
}

func TestGPTImageUsesStrictOpenAIRequests(t *testing.T) {
	server := fakeImageServer(t, func(r *http.Request, body []byte) {
		if r.URL.Path != "/images/generations" {
			t.Fatalf("path %s", r.URL.Path)
		}
		var payload map[string]any
		_ = json.Unmarshal(body, &payload)
		if _, ok := payload["prompt_extend"]; ok {
			t.Fatal("gpt-image must not receive prompt_extend")
		}
	})
	defer server.Close()
	p := &AntDigital{BaseURL: server.URL, APIKey: "k"}
	if _, err := p.Generate(context.Background(), ImageRequest{Model: "gpt-image-2.5-sunburst", Prompt: "p", PromptExtend: true}); err != nil {
		t.Fatal(err)
	}
}

func TestGPTImageReferenceGoesToEdits(t *testing.T) {
	server := fakeImageServer(t, func(r *http.Request, body []byte) {
		if r.URL.Path != "/images/edits" || !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
			t.Fatalf("want multipart edits, got %s %s", r.URL.Path, r.Header.Get("Content-Type"))
		}
		if !strings.Contains(string(body), `name="image"; filename="reference.png"`) || !strings.Contains(string(body), "gpt-image-2.5-sunburst") {
			t.Fatal("multipart body missing image or model")
		}
	})
	defer server.Close()
	p := &AntDigital{BaseURL: server.URL, APIKey: "k"}
	ref := "data:image/png;base64,iVBORw0KGgo="
	if _, err := p.Generate(context.Background(), ImageRequest{Model: "gpt-image-2.5-sunburst", Prompt: "p", ReferenceImage: ref}); err != nil {
		t.Fatal(err)
	}
}

func TestOtherModelsKeepVendorFields(t *testing.T) {
	server := fakeImageServer(t, func(r *http.Request, body []byte) {
		var payload map[string]any
		_ = json.Unmarshal(body, &payload)
		if r.URL.Path != "/images/generations" || payload["prompt_extend"] != true {
			t.Fatalf("qwen request changed: %s %v", r.URL.Path, payload)
		}
	})
	defer server.Close()
	p := &AntDigital{BaseURL: server.URL, APIKey: "k"}
	if _, err := p.Generate(context.Background(), ImageRequest{Model: "qwen-image-2.0", Prompt: "p", PromptExtend: true}); err != nil {
		t.Fatal(err)
	}
}
