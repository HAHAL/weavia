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
	"strings"
	"time"
)

// VolcengineVideo 接入火山方舟（字节）视频生成：创建任务 + 轮询 + 取结果。
// 文档：POST /contents/generations/tasks，GET /contents/generations/tasks/{id}
type VolcengineVideo struct {
	BaseURL, APIKey string
	Timeout         time.Duration
	PollInterval    time.Duration
	Client          *http.Client
}

func (p *VolcengineVideo) endpoint(parts ...string) (string, error) {
	base := strings.TrimRight(p.BaseURL, "/")
	if base == "" {
		base = "https://ark.cn-beijing.volces.com/api/v3"
	}
	return url.JoinPath(base, parts...)
}

func (p *VolcengineVideo) Generate(ctx context.Context, input ImageRequest) (ImageResult, error) {
	if input.Prompt == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "Prompt is required", false, 400}
	}
	model := input.Model
	if model == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "Video model is required", false, 400}
	}
	content := []any{map[string]any{"type": "text", "text": input.Prompt}}
	if reference := firstNonEmpty(input.ReferenceURL, input.ReferenceImage); reference != "" {
		content = append(content, map[string]any{
			"type":      "image_url",
			"image_url": map[string]any{"url": reference},
			"role":      "first_frame",
		})
	}
	duration := input.Duration
	if duration <= 0 {
		duration = 5
	}
	ratio := "16:9"
	if strings.Contains(input.Size, "720*1280") || strings.Contains(input.Size, "1080*1920") {
		ratio = "9:16"
	} else if strings.Contains(input.Size, "1024*1024") {
		ratio = "1:1"
	}
	body := map[string]any{
		"model":      model,
		"content":    content,
		"ratio":      ratio,
		"duration":   duration,
		"resolution": "720p",
	}
	encoded, _ := json.Marshal(body)
	endpoint, err := p.endpoint("contents", "generations", "tasks")
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
	var submitted struct {
		ID    string `json:"id"`
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(raw, &submitted)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		slog.Warn("volcengine video rejected", "status", resp.StatusCode, "model", model, "body", string(raw))
		return ImageResult{}, mapHTTPError(resp.StatusCode, map[string]any{"message": submitted.Error.Message, "code": submitted.Error.Code})
	}
	if submitted.ID == "" {
		return ImageResult{}, &Error{"GENERATION_FAILED", "Video provider did not return a task id", false, 502}
	}
	if input.OnSubmitted != nil {
		input.OnSubmitted(submitted.ID)
	}
	poll := p.PollInterval
	if poll == 0 {
		poll = 5 * time.Second
	}
	for {
		select {
		case <-requestCtx.Done():
			return ImageResult{}, &Error{"TIMEOUT", "Video task timed out", true, 504}
		case <-time.After(poll):
		}
		status, _, uri, pollErr := p.poll(requestCtx, client, submitted.ID)
		if pollErr != nil {
			return ImageResult{}, pollErr
		}
		slog.Info("volcengine video poll", "task", submitted.ID, "status", status)
		switch status {
		case "succeeded":
			if uri == "" {
				return ImageResult{}, &Error{"GENERATION_FAILED", "Video result missing URL", false, 502}
			}
			return ImageResult{ProviderRequestID: submitted.ID, Outputs: []Output{{URI: uri, MediaType: "video/mp4"}}}, nil
		case "failed", "expired", "cancelled":
			return ImageResult{}, &Error{"GENERATION_FAILED", "Video generation failed", false, 502}
		}
	}
}

func (p *VolcengineVideo) poll(ctx context.Context, client *http.Client, taskID string) (string, string, string, error) {
	endpoint, err := p.endpoint("contents", "generations", "tasks", taskID)
	if err != nil {
		return "", "", "", err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", &Error{"NETWORK_ERROR", "Unable to reach video provider", true, 502}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	var payload struct {
		Status  string `json:"status"`
		Content struct {
			VideoURL string `json:"video_url"`
		} `json:"content"`
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(raw, &payload)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", "", mapHTTPError(resp.StatusCode, map[string]any{"message": payload.Error.Message, "code": payload.Error.Code})
	}
	return payload.Status, payload.Error.Message, payload.Content.VideoURL, nil
}

// ResumeWithConfig 供 Worker 恢复任务时使用：只查询，不重新提交。
func (p *VolcengineVideo) ResumeWithConfig(ctx context.Context, taskID, apiKey, baseURL string) (ImageResult, error) {
	provider := *p
	if apiKey != "" {
		provider.APIKey = apiKey
	}
	if baseURL != "" {
		provider.BaseURL = baseURL
	}
	client := provider.Client
	if client == nil {
		client = http.DefaultClient
	}
	status, message, uri, err := provider.poll(ctx, client, taskID)
	if err != nil {
		return ImageResult{}, err
	}
	switch status {
	case "queued", "running":
		return ImageResult{}, &Error{"TASK_RUNNING", "Video task is still running", true, 409}
	case "succeeded":
		if uri == "" {
			return ImageResult{}, &Error{"GENERATION_FAILED", "Video result missing URL", false, 502}
		}
		return ImageResult{ProviderRequestID: taskID, Outputs: []Output{{URI: uri, MediaType: "video/mp4"}}}, nil
	default:
		if message == "" {
			message = "Video task did not succeed"
		}
		return ImageResult{}, &Error{"GENERATION_FAILED", message, false, 502}
	}
}

func (p *VolcengineVideo) String() string { return fmt.Sprintf("volcengine-video(%s)", p.BaseURL) }
