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

// DashScopeImageEdit implements the async Wanx image-edit API, including
// description_edit_with_mask. It submits a task, polls until terminal and
// returns the result URLs for the storage layer.
type DashScopeImageEdit struct {
	BaseURL      string
	APIKey       string
	Model        string
	Timeout      time.Duration
	PollInterval time.Duration
	Client       *http.Client
}

type dashTask struct {
	Output struct {
		TaskID     string `json:"task_id"`
		TaskStatus string `json:"task_status"`
		Code       string `json:"code"`
		Message    string `json:"message"`
		Results    []struct {
			URL string `json:"url"`
		} `json:"results"`
	} `json:"output"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (p *DashScopeImageEdit) Generate(ctx context.Context, input ImageRequest) (ImageResult, error) {
	reference := strings.TrimSpace(input.ReferenceURL)
	if reference == "" {
		reference = strings.TrimSpace(input.ReferenceImage)
	}
	if reference == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "参考图不能为空", false, 400}
	}
	if strings.TrimSpace(input.Prompt) == "" {
		return ImageResult{}, &Error{"INVALID_REQUEST", "提示词不能为空", false, 400}
	}
	model := p.Model
	if model == "" {
		model = "wanx2.1-imageedit"
	}
	function := "description_edit"
	if strings.TrimSpace(input.MaskImage) != "" {
		function = "description_edit_with_mask"
	}
	body := map[string]any{
		"model": model,
		"input": map[string]any{
			"function":       function,
			"prompt":         input.Prompt,
			"base_image_url": reference,
		},
		"parameters": map[string]any{"n": 1},
	}
	if input.MaskImage != "" {
		body["input"].(map[string]any)["mask_image_url"] = input.MaskImage
	}
	encoded, _ := json.Marshal(body)
	endpoint, err := url.JoinPath(p.BaseURL, "services/aigc/image2image/image-synthesis")
	if err != nil {
		return ImageResult{}, err
	}
	timeout := p.Timeout
	if timeout == 0 {
		timeout = 3 * time.Minute
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
	response, err := client.Do(req)
	if err != nil {
		if requestCtx.Err() != nil {
			return ImageResult{}, &Error{"TIMEOUT", "Provider request timed out", true, 504}
		}
		return ImageResult{}, &Error{"NETWORK_ERROR", "Unable to reach image provider", true, 502}
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	var submitted dashTask
	_ = json.Unmarshal(raw, &submitted)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ImageResult{}, mapHTTPError(response.StatusCode, map[string]any{"message": submitted.Message, "code": submitted.Code})
	}
	if submitted.Output.TaskID == "" {
		return ImageResult{}, &Error{"GENERATION_FAILED", "Provider did not return a task id", false, 502}
	}
	taskID := submitted.Output.TaskID
	poll := p.PollInterval
	if poll == 0 {
		poll = 2 * time.Second
	}
	for {
		select {
		case <-requestCtx.Done():
			return ImageResult{}, &Error{"TIMEOUT", "Provider task timed out", true, 504}
		case <-time.After(poll):
		}
		status, err := p.poll(requestCtx, client, taskID)
		if err != nil {
			return ImageResult{}, err
		}
		switch status.Output.TaskStatus {
		case "SUCCEEDED":
			result := ImageResult{ProviderRequestID: taskID}
			for _, item := range status.Output.Results {
				if item.URL != "" {
					result.Outputs = append(result.Outputs, Output{URI: item.URL, MediaType: "image/png"})
				}
			}
			if len(result.Outputs) == 0 {
				return ImageResult{}, &Error{"GENERATION_FAILED", "Provider returned no image", false, 502}
			}
			return result, nil
		case "FAILED", "CANCELED", "UNKNOWN":
			code := status.Output.Code
			if code == "" {
				code = "GENERATION_FAILED"
			}
			message := status.Output.Message
			if message == "" {
				message = "Provider task failed"
			}
			return ImageResult{}, &Error{code, message, false, 502}
		}
	}
}

func (p *DashScopeImageEdit) poll(ctx context.Context, client *http.Client, taskID string) (dashTask, error) {
	endpoint, err := url.JoinPath(p.BaseURL, "tasks", taskID)
	if err != nil {
		return dashTask{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return dashTask{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	response, err := client.Do(req)
	if err != nil {
		return dashTask{}, &Error{"NETWORK_ERROR", "Unable to poll image provider", true, 502}
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	var payload dashTask
	_ = json.Unmarshal(raw, &payload)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return dashTask{}, mapHTTPError(response.StatusCode, map[string]any{"message": payload.Message, "code": payload.Code})
	}
	return payload, nil
}

func (p *DashScopeImageEdit) String() string { return fmt.Sprintf("dashscope-imageedit(%s)", p.Model) }
