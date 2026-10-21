package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"
)

type DashScopeVideo struct {
	BaseURL, APIKey string
	Timeout         time.Duration
	PollInterval    time.Duration
	Client          *http.Client
}

func (p *DashScopeVideo) Generate(ctx context.Context, input ImageRequest) (ImageResult, error) {
	if input.Prompt == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "Prompt is required", false, 400}
	}
	model := input.Model
	if model == "" {
		model = "wan2.7-t2v"
	}
	duration := input.Duration
	if duration <= 0 {
		duration = 5
	}
	size := input.Size
	if size == "" {
		size = "1280*720"
	}
	body := map[string]any{"model": model, "input": map[string]any{"prompt": input.Prompt}, "parameters": map[string]any{"size": size, "duration": duration, "prompt_extend": input.PromptExtend}}
	encoded, _ := json.Marshal(body)
	endpoint, err := url.JoinPath(p.BaseURL, "services/aigc/video-generation/video-synthesis")
	if err != nil {
		return ImageResult{}, err
	}
	timeout := p.Timeout
	if timeout == 0 {
		timeout = 10 * time.Minute
	}
	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return ImageResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable")
	client := p.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return ImageResult{}, &Error{"NETWORK_ERROR", "Unable to reach video provider", true, 502}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	var submitted dashTask
	_ = json.Unmarshal(raw, &submitted)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		slog.Warn("dashscope video rejected", "status", resp.StatusCode, "body", string(raw), "model", model, "base", p.BaseURL)
		return ImageResult{}, mapHTTPError(resp.StatusCode, map[string]any{"message": submitted.Message, "code": submitted.Code})
	}
	slog.Info("dashscope video submitted", "task", submitted.Output.TaskID, "model", model)
	if submitted.Output.TaskID != "" && input.OnSubmitted != nil {
		input.OnSubmitted(submitted.Output.TaskID)
	}
	if submitted.Output.TaskID == "" {
		return ImageResult{}, &Error{"GENERATION_FAILED", "Video provider did not return a task id", false, 502}
	}
	poll := p.PollInterval
	if poll == 0 {
		poll = 3 * time.Second
	}
	for {
		select {
		case <-requestCtx.Done():
			return ImageResult{}, &Error{"TIMEOUT", "Video task timed out", true, 504}
		case <-time.After(poll):
		}
		status, err := p.poll(requestCtx, client, submitted.Output.TaskID)
		if err != nil {
			return ImageResult{}, err
		}
		slog.Info("dashscope video poll", "task", submitted.Output.TaskID, "status", status)
		if status == "SUCCEEDED" {
			return p.result(requestCtx, client, submitted.Output.TaskID)
		}
		if status == "FAILED" || status == "CANCELED" {
			return ImageResult{}, &Error{"GENERATION_FAILED", "Video generation failed", false, 502}
		}
	}
}

func (p *DashScopeVideo) poll(ctx context.Context, client *http.Client, taskID string) (string, error) {
	endpoint, err := url.JoinPath(p.BaseURL, "tasks", taskID)
	if err != nil {
		return "", err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	resp, err := client.Do(req)
	if err != nil {
		return "", &Error{"NETWORK_ERROR", "Unable to reach video provider", true, 502}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	var task struct {
		Output struct {
			TaskStatus string `json:"task_status"`
			Message    string `json:"message"`
		} `json:"output"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(raw, &task)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", mapHTTPError(resp.StatusCode, map[string]any{"message": task.Message})
	}
	return task.Output.TaskStatus, nil
}

func (p *DashScopeVideo) result(ctx context.Context, client *http.Client, taskID string) (ImageResult, error) {
	endpoint, err := url.JoinPath(p.BaseURL, "tasks", taskID)
	if err != nil {
		return ImageResult{}, err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	resp, err := client.Do(req)
	if err != nil {
		return ImageResult{}, &Error{"NETWORK_ERROR", "Unable to read video result", true, 502}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	var payload struct {
		Output struct {
			TaskID   string `json:"task_id"`
			VideoURL string `json:"video_url"`
			Results  []struct {
				URL string `json:"url"`
			} `json:"results"`
		} `json:"output"`
		RequestID string `json:"request_id"`
	}
	_ = json.Unmarshal(raw, &payload)
	uri := payload.Output.VideoURL
	if uri == "" && len(payload.Output.Results) > 0 {
		uri = payload.Output.Results[0].URL
	}
	if uri == "" {
		return ImageResult{}, &Error{"GENERATION_FAILED", "Video result missing URL", false, 502}
	}
	return ImageResult{ProviderRequestID: payload.RequestID, Outputs: []Output{{URI: uri, MediaType: "video/mp4"}}}, nil
}

func (p *DashScopeVideo) Resume(ctx context.Context, taskID string) (ImageResult, error) {
	client := p.Client
	if client == nil {
		client = http.DefaultClient
	}
	status, err := p.poll(ctx, client, taskID)
	if err != nil {
		return ImageResult{}, err
	}
	if status == "RUNNING" || status == "PENDING" {
		return ImageResult{}, &Error{"TASK_RUNNING", "Video task is still running", true, 409}
	}
	if status != "SUCCEEDED" {
		return ImageResult{}, &Error{"GENERATION_FAILED", "Video task did not succeed", false, 502}
	}
	return p.result(ctx, client, taskID)
}

func (p *DashScopeVideo) String() string { return fmt.Sprintf("dashscope-video(%s)", p.BaseURL) }
