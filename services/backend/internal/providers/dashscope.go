package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"time"
)

type DashScope struct {
	BaseURL string
	APIKey  string
	Model   string
	Timeout time.Duration
	Client  *http.Client
}

func (p *DashScope) Generate(ctx context.Context, input ImageRequest) (ImageResult, error) {
	if input.ReferenceImage == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "参考图不能为空", false, 400}
	}
	body := map[string]any{
		"model": p.Model,
		"input": map[string]any{
			"messages": []any{map[string]any{
				"role": "user",
				"content": []any{
					map[string]string{"image": input.ReferenceImage},
					map[string]string{"text": input.Prompt},
				},
			}},
		},
		"parameters": map[string]any{
			"n": 1, "prompt_extend": true, "watermark": false, "size": "1024*1024",
		},
	}
	encoded, _ := json.Marshal(body)
	endpoint, err := url.JoinPath(p.BaseURL, "services/aigc/multimodal-generation/generation")
	if err != nil {
		return ImageResult{}, err
	}
	timeout := p.Timeout
	if timeout == 0 {
		timeout = 120 * time.Second
	}
	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return ImageResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "disable")
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
		Output struct {
			Choices []struct {
				Message struct {
					Content []struct {
						Image string `json:"image"`
					} `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		} `json:"output"`
		RequestID string `json:"request_id"`
		Code      string `json:"code"`
		Message   string `json:"message"`
	}
	_ = json.Unmarshal(raw, &payload)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ImageResult{}, mapHTTPError(response.StatusCode, map[string]any{"message": payload.Message, "code": payload.Code})
	}
	result := ImageResult{ProviderRequestID: payload.RequestID}
	for _, choice := range payload.Output.Choices {
		for _, content := range choice.Message.Content {
			if content.Image != "" {
				result.Outputs = append(result.Outputs, Output{content.Image, "image/png"})
			}
		}
	}
	if len(result.Outputs) == 0 {
		return ImageResult{}, &Error{"GENERATION_FAILED", "Provider response did not contain an image", false, 502}
	}
	return result, nil
}

type Router struct {
	AntDigital *AntDigital
	DashScope  *DashScope
}

func (r *Router) Generate(ctx context.Context, input ImageRequest) (ImageResult, error) {
	if input.Model == r.DashScope.Model {
		return r.DashScope.Generate(ctx, input)
	}
	return r.AntDigital.Generate(ctx, input)
}
