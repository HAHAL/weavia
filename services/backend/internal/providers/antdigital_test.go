package providers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestAntDigitalContractAndRequestID(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if got := r.Header.Get("Authorization"); got != "Bearer secret" {
			t.Fatalf("authorization = %q", got)
		}
		if got := r.Header.Get("Idempotency-Key"); got != "idem" {
			t.Fatalf("idempotency = %q", got)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["model"] != "qwen-image-2.0" || body["image"] != "data:image/png;base64,AA==" {
			t.Fatalf("body = %#v", body)
		}
		return &http.Response{StatusCode: 200, Header: http.Header{"X-Request-Id": []string{"req-123"}}, Body: io.NopCloser(strings.NewReader(`{"data":[{"url":"https://example.test/image.png"}]}`))}, nil
	})}
	provider := &AntDigital{BaseURL: "https://provider.test/v1", APIKey: "secret", Timeout: time.Second, Client: client}
	result, err := provider.Generate(context.Background(), ImageRequest{Model: "qwen-image-2.0", Prompt: "ad", ReferenceImage: "data:image/png;base64,AA==", IdempotencyKey: "idem"})
	if err != nil {
		t.Fatal(err)
	}
	if result.ProviderRequestID != "req-123" || len(result.Outputs) != 1 {
		t.Fatalf("result = %#v", result)
	}
}

func TestAntDigitalDoesNotAllowReferenceOnWrongModel(t *testing.T) {
	provider := &AntDigital{}
	_, err := provider.Generate(context.Background(), ImageRequest{Model: "qwen-image-max", Prompt: "ad", ReferenceImage: "data:image/png;base64,AA=="})
	typed, ok := err.(*Error)
	if !ok || typed.Code != "UNSUPPORTED_CAPABILITY" {
		t.Fatalf("error = %#v", err)
	}
}
