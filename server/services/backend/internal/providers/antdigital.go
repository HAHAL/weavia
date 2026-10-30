package providers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type ImageRequest struct {
	Model, Provider, Prompt, ReferenceImage, MaskImage, Size, IdempotencyKey, APIKey, BaseURL, Mode string
	Count                                                                                           int
	PromptExtend                                                                                    bool
	NegativePrompt, Seed, OutputFormat, ReferenceURL                                                string
	Watermark                                                                                       bool
	ReferenceStrength                                                                               float64
	Duration                                                                                        int
	OnSubmitted                                                                                     func(string)
}
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
	size := input.Size
	if size == "" {
		size = "1024x1024"
	}
	count := input.Count
	if count < 1 {
		count = 1
	}
	if openAIImageModel(input.Model) {
		return p.generateOpenAI(ctx, input, size, count)
	}
	body := map[string]any{"model": input.Model, "prompt": input.Prompt, "size": size, "n": count, "prompt_extend": input.PromptExtend}
	if input.NegativePrompt != "" {
		body["negative_prompt"] = input.NegativePrompt
	}
	if input.Seed != "" {
		body["seed"] = input.Seed
	}
	if input.OutputFormat != "" && input.OutputFormat != "png" {
		body["output_format"] = input.OutputFormat
	}
	if input.Watermark {
		body["watermark"] = true
	}
	if input.ReferenceImage != "" {
		body["image"] = input.ReferenceImage
		if input.ReferenceStrength > 0 {
			body["strength"] = input.ReferenceStrength
		}
	}
	encoded, _ := json.Marshal(body)
	return p.send(ctx, input, "images/generations", "application/json", encoded)
}

// openAIImageModel reports models that gateways validate against the strict
// OpenAI Images API: vendor fields such as prompt_extend are rejected and a
// reference image must go to /images/edits as a multipart file.
func openAIImageModel(model string) bool {
	m := strings.ToLower(model)
	return strings.HasPrefix(m, "gpt-image") || strings.HasPrefix(m, "dall-e")
}

func (p *AntDigital) generateOpenAI(ctx context.Context, input ImageRequest, size string, count int) (ImageResult, error) {
	reference := input.ReferenceImage
	if reference == "" {
		reference = input.ReferenceURL
	}
	if reference == "" {
		encoded, _ := json.Marshal(map[string]any{"model": input.Model, "prompt": input.Prompt, "size": size, "n": count})
		return p.send(ctx, input, "images/generations", "application/json", encoded)
	}
	image, mime, err := loadReference(ctx, reference)
	if err != nil {
		return ImageResult{}, &Error{"INVALID_REQUEST", "Reference image unavailable: " + err.Error(), false, 400}
	}
	var form bytes.Buffer
	writer := multipart.NewWriter(&form)
	for key, value := range map[string]string{"model": input.Model, "prompt": input.Prompt, "size": size, "n": strconv.Itoa(count)} {
		_ = writer.WriteField(key, value)
	}
	ext := map[string]string{"image/jpeg": "jpg", "image/webp": "webp"}[mime]
	if ext == "" {
		ext = "png"
	}
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="image"; filename="reference.%s"`, ext))
	header.Set("Content-Type", mime)
	part, err := writer.CreatePart(header)
	if err != nil {
		return ImageResult{}, err
	}
	_, _ = part.Write(image)
	if err := writer.Close(); err != nil {
		return ImageResult{}, err
	}
	return p.send(ctx, input, "images/edits", writer.FormDataContentType(), form.Bytes())
}

// loadReference decodes a data URI or downloads an https reference image.
func loadReference(ctx context.Context, reference string) ([]byte, string, error) {
	if strings.HasPrefix(reference, "data:") {
		head, data, ok := strings.Cut(reference, ",")
		if !ok || !strings.HasSuffix(head, ";base64") {
			return nil, "", fmt.Errorf("invalid data URI")
		}
		body, err := base64.StdEncoding.DecodeString(data)
		return body, strings.TrimSuffix(strings.TrimPrefix(head, "data:"), ";base64"), err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reference, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download returned %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	mime := resp.Header.Get("Content-Type")
	if mime == "" {
		mime = http.DetectContentType(body)
	}
	return body, mime, err
}

func (p *AntDigital) send(ctx context.Context, input ImageRequest, path, contentType string, requestBody []byte) (ImageResult, error) {
	requestURL, err := url.JoinPath(p.BaseURL, path)
	if err != nil {
		return ImageResult{}, err
	}
	timeout := p.Timeout
	if timeout == 0 {
		timeout = 120 * time.Second
	}
	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, requestURL, bytes.NewReader(requestBody))
	if err != nil {
		return ImageResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	req.Header.Set("Content-Type", contentType)
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
