// Package vision breaks a reference video (sampled key frames) into an editable
// shot structure using an OpenAI-compatible multimodal chat model on one of the
// configured provider channels.
package vision

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/weavia/weavia/services/backend/internal/generation"
)

type Shot struct {
	Start    float64 `json:"start"`
	Duration float64 `json:"duration"`
	Framing  string  `json:"framing"`
	Camera   string  `json:"camera"`
	Visual   string  `json:"visual"`
	Caption  string  `json:"caption"`
	Voice    string  `json:"voice"`
}

type Structure struct {
	Hook   string `json:"hook"`
	Rhythm string `json:"rhythm"`
	Music  string `json:"music"`
	Shots  []Shot `json:"shots"`
}

type KeyReader interface {
	GetChannelKey(ctx context.Context, channelID string) (string, error)
}

type Service struct {
	pool   *pgxpool.Pool
	keys   KeyReader
	client *http.Client
	mu     sync.Mutex
	usage  map[string][]time.Time
}

func New(pool *pgxpool.Pool, keys KeyReader) *Service {
	return &Service{pool: pool, keys: keys, client: &http.Client{Timeout: 120 * time.Second}, usage: map[string][]time.Time{}}
}

const dailyLimit = 30

func (s *Service) allow(userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	cutoff := time.Now().Add(-24 * time.Hour)
	kept := s.usage[userID][:0]
	for _, at := range s.usage[userID] {
		if at.After(cutoff) {
			kept = append(kept, at)
		}
	}
	if len(kept) >= dailyLimit {
		s.usage[userID] = kept
		return false
	}
	s.usage[userID] = append(kept, time.Now())
	return true
}

const prompt = `你是电商短视频分镜分析师。下面是一条参考视频按时间顺序抽取的关键帧，总时长 %.1f 秒，每帧的时间点已标注。
请拆解它的结构，只输出 JSON，不要任何解释，格式：
{"hook":"开头钩子类型，如 痛点提问/效果对比/悬念","rhythm":"节奏描述","music":"配乐风格","shots":[{"start":0,"duration":2.5,"framing":"景别","camera":"运镜","visual":"画面内容（不提及原视频中的品牌、人物身份）","caption":"屏幕字幕","voice":"口播要点"}]}
要求：3-8 个镜头，时长之和约等于总时长；visual 用可以直接指导重拍的描述。`

// Analyze sends frames (data URLs) with their timestamps and returns the shot structure.
func (s *Service) Analyze(ctx context.Context, userID string, frames []string, times []float64, duration float64) (Structure, error) {
	if len(frames) < 2 || len(frames) > 12 || len(times) != len(frames) || duration <= 0 || duration > 180 {
		return Structure{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "需要 2-12 张关键帧，视频时长不超过 3 分钟", Status: 400}
	}
	for _, frame := range frames {
		if !strings.HasPrefix(frame, "data:image/jpeg;base64,") && !strings.HasPrefix(frame, "data:image/png;base64,") || len(frame) > 1<<20 {
			return Structure{}, &generation.APIError{Code: "INVALID_REQUEST", Message: "关键帧必须是 1MB 以内的 JPEG/PNG", Status: 400}
		}
	}
	if !s.allow(userID) {
		return Structure{}, &generation.APIError{Code: "RATE_LIMITED", Message: "今天的视频拆解次数已用完，请明天再试", Status: 429}
	}
	var provider, model string
	if err := s.pool.QueryRow(ctx, `SELECT vision_provider, vision_model FROM client_config WHERE id=true`).Scan(&provider, &model); err != nil || model == "" {
		return Structure{}, &generation.APIError{Code: "VISION_NOT_CONFIGURED", Message: "未配置视频拆解模型，请在后台「客户端发布」填写", Status: 503}
	}
	var channelID, baseURL string
	if err := s.pool.QueryRow(ctx, `SELECT id::text, base_url FROM provider_channels WHERE provider_code=$1 AND enabled ORDER BY priority, created_at LIMIT 1`, provider).Scan(&channelID, &baseURL); err != nil {
		return Structure{}, &generation.APIError{Code: "VISION_NOT_CONFIGURED", Message: "视频拆解渠道不可用", Status: 503}
	}
	key, err := s.keys.GetChannelKey(ctx, channelID)
	if err != nil || key == "" {
		return Structure{}, &generation.APIError{Code: "VISION_NOT_CONFIGURED", Message: "视频拆解渠道没有可用 Key", Status: 503}
	}
	content := []any{map[string]any{"type": "text", "text": fmt.Sprintf(prompt, duration)}}
	for i, frame := range frames {
		content = append(content, map[string]any{"type": "text", "text": fmt.Sprintf("第 %d 帧，%.1f 秒", i+1, times[i])}, map[string]any{"type": "image_url", "image_url": map[string]any{"url": frame}})
	}
	body, _ := json.Marshal(map[string]any{"model": model, "messages": []any{map[string]any{"role": "user", "content": content}}, "temperature": 0.2})
	endpoint := strings.TrimRight(compatibleBase(provider, baseURL), "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return Structure{}, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	res, err := s.client.Do(req)
	if err != nil {
		return Structure{}, &generation.APIError{Code: "VISION_UNAVAILABLE", Message: "视频拆解服务暂不可用，请稍后再试", Status: 503}
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if res.StatusCode >= 300 {
		return Structure{}, &generation.APIError{Code: "VISION_UNAVAILABLE", Message: fmt.Sprintf("视频拆解模型返回错误 (%d)，请检查模型名是否已开通", res.StatusCode), Status: 502}
	}
	var reply struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &reply); err != nil || len(reply.Choices) == 0 {
		return Structure{}, &generation.APIError{Code: "VISION_BAD_REPLY", Message: "拆解结果无法解析，请重试", Status: 502}
	}
	return ParseStructure(reply.Choices[0].Message.Content, duration)
}

// compatibleBase maps a channel base URL to its OpenAI-compatible root.
func compatibleBase(provider, base string) string {
	if provider == "dashscope" {
		return strings.Replace(strings.TrimRight(base, "/"), "/api/v1", "/compatible-mode/v1", 1)
	}
	return base
}

// ParseStructure extracts the JSON object from a model reply and normalizes it.
func ParseStructure(text string, duration float64) (Structure, error) {
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end <= start {
		return Structure{}, &generation.APIError{Code: "VISION_BAD_REPLY", Message: "拆解结果无法解析，请重试", Status: 502}
	}
	var out Structure
	if err := json.Unmarshal([]byte(text[start:end+1]), &out); err != nil || len(out.Shots) == 0 {
		return Structure{}, &generation.APIError{Code: "VISION_BAD_REPLY", Message: "拆解结果无法解析，请重试", Status: 502}
	}
	if len(out.Shots) > 8 {
		out.Shots = out.Shots[:8]
	}
	at := 0.0
	for i := range out.Shots {
		if out.Shots[i].Duration <= 0 {
			out.Shots[i].Duration = duration / float64(len(out.Shots))
		}
		out.Shots[i].Start = at
		at += out.Shots[i].Duration
	}
	return out, nil
}
