package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type ImageRequest struct{ Model, Provider, Prompt, ReferenceImage, IdempotencyKey string }
type ImageResult struct {
	ProviderRequestID string
	Outputs           []Output
}
type Output struct {
	URI       string `json:"uri"`
	MediaType string `json:"mediaType"`
}
type Error struct {
	Code, Message string
	Retryable     bool
	Status        int
}

func (e *Error) Error() string { return e.Message }

type AntDigital struct {
	BaseURL, APIKey string
	Timeout         time.Duration
	Client          *http.Client
}

func (p *AntDigital) Generate(ctx context.Context, input ImageRequest) (ImageResult, error) {
	if strings.TrimSpace(input.Prompt) == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "Prompt is required", false, 400}
	}
	body := map[string]any{"model": input.Model, "prompt": input.Prompt, "size": "1024x1024", "n": 1, "prompt_extend": true}
	if input.ReferenceImage != "" {
		body["image"] = input.ReferenceImage
	}
	encoded, _ := json.Marshal(body)
	requestURL, err := url.JoinPath(p.BaseURL, "images/generations")
	if err != nil {
		return ImageResult{}, err
	}
	timeout := p.Timeout
	if timeout == 0 {
		timeout = 120 * time.Second
	}
	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, requestURL, bytes.NewReader(encoded))
	if err != nil {
		return ImageResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", input.IdempotencyKey)
	client := p.Client
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(req)
	if err != nil {
		if requestCtx.Err() != nil {
			return ImageResult{}, &Error{"TIMEOUT", "Provider request timed out", true, 504}
		}
		return ImageResult{}, &Error{"NETWORK_ERROR", "Unable to reach image provider", true, 502}
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	var payload struct {
		ID        string `json:"id"`
		RequestID string `json:"request_id"`
		Data      []struct {
			URL string `json:"url"`
			B64 string `json:"b64_json"`
		} `json:"data"`
		Error any `json:"error"`
	}
	_ = json.Unmarshal(raw, &payload)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ImageResult{}, mapHTTPError(response.StatusCode, payload.Error)
	}
	result := ImageResult{ProviderRequestID: response.Header.Get("X-Request-ID")}
	if result.ProviderRequestID == "" {
		result.ProviderRequestID = payload.RequestID
	}
	if result.ProviderRequestID == "" {
		result.ProviderRequestID = payload.ID
	}
	for _, item := range payload.Data {
		if item.URL != "" {
			result.Outputs = append(result.Outputs, Output{item.URL, "image/png"})
		} else if item.B64 != "" {
			result.Outputs = append(result.Outputs, Output{"data:image/png;base64," + item.B64, "image/png"})
		}
	}
	if len(result.Outputs) == 0 {
		return ImageResult{}, &Error{"GENERATION_FAILED", "Provider response did not contain an image", false, 502}
	}
	if result.ProviderRequestID == "" {
		result.ProviderRequestID = "antdigital-" + input.IdempotencyKey
	}
	return result, nil
}

func mapHTTPError(status int, detail any) error {
	message := fmt.Sprintf("Provider error %d", status)
	if object, ok := detail.(map[string]any); ok {
		if text, ok := object["message"].(string); ok {
			message = text
		}
	}
	switch {
	case status == 401 || status == 403:
		return &Error{"AUTH_FAILED", "Provider authentication failed", false, status}
	case status == 429:
		return &Error{"PROVIDER_RATE_LIMITED", "Provider rate limit reached", true, status}
	case status == 400 || status == 422:
		return &Error{"INVALID_REQUEST", message, false, status}
	case status >= 500:
		return &Error{"PROVIDER_UNAVAILABLE", "Image provider is temporarily unavailable", true, status}
	default:
		return &Error{"UNKNOWN", message, false, status}
	}
}
