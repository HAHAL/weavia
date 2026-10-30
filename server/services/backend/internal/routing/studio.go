package routing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/weavia/weavia/services/backend/internal/generation"
)

// Modalities a model can read or produce. audio = music / sound effects,
// speech = human voice.
var Modalities = []string{"text", "image", "video", "audio", "speech"}

// purposeIO is the input → output contract of each purpose. A model's
// modalities are derived from its purposes so the two never disagree.
var purposeIO = map[string][2][]string{
	"text_to_image":      {{"text"}, {"image"}},
	"image_to_image":     {{"text", "image"}, {"image"}},
	"image_edit":         {{"text", "image"}, {"image"}},
	"text_to_video":      {{"text"}, {"video"}},
	"image_to_video":     {{"text", "image"}, {"video"}},
	"reference_to_video": {{"text", "image"}, {"video"}},
	"video_edit":         {{"text", "video"}, {"video"}},
	"vision":             {{"text", "image", "video"}, {"text"}},
	"text_generation":    {{"text"}, {"text"}},
	"tts":                {{"text"}, {"speech"}},
	"asr":                {{"speech"}, {"text"}},
	"audio_generation":   {{"text"}, {"audio"}},
}

// Purposes are the capability values a logical model may carry. The client
// groups models by them and only offers a model for inputs it supports.
var Purposes = []string{"text_to_image", "image_to_image", "image_edit", "text_to_video", "image_to_video", "reference_to_video", "video_edit", "vision", "text_generation", "tts", "asr", "audio_generation"}

// DeriveIO returns the input and output modalities implied by purposes, in
// Modalities order, plus the primary output stored in logical_models.modality.
func DeriveIO(purposes []string) (inputs, outputs []string, primary string) {
	in, out := map[string]bool{}, map[string]bool{}
	for _, p := range purposes {
		io, ok := purposeIO[p]
		if !ok {
			continue
		}
		for _, m := range io[0] {
			in[m] = true
		}
		for _, m := range io[1] {
			out[m] = true
		}
	}
	for _, m := range Modalities {
		if in[m] {
			inputs = append(inputs, m)
		}
		if out[m] {
			outputs = append(outputs, m)
		}
	}
	// Generated media wins over text: a model that both writes and draws is an image model.
	for _, m := range []string{"video", "image", "speech", "audio", "text"} {
		if out[m] {
			return inputs, outputs, m
		}
	}
	return inputs, outputs, "image"
}

// SuggestPurposes guesses modality and capabilities from a provider model id.
// It is only a starting point shown to the operator, never applied silently.
func SuggestPurposes(id string) (string, []string) {
	v := strings.ToLower(id)
	has := func(parts ...string) bool {
		for _, part := range parts {
			if strings.Contains(v, part) {
				return true
			}
		}
		return false
	}
	switch {
	case has("vl-", "-vl", "vision", "omni", "qvq"):
		return "text", []string{"vision"}
	case has("tts", "cosyvoice", "sambert", "speech-synth", "text-to-speech"):
		return "speech", []string{"tts"}
	case has("asr", "paraformer", "sensevoice", "whisper", "transcri"):
		return "text", []string{"asr"}
	case has("music", "suno", "audio", "sound"):
		return "audio", []string{"audio_generation"}
	case has("videoedit", "video-edit", "video_edit"):
		return "video", []string{"video_edit"}
	case has("r2v"):
		return "video", []string{"reference_to_video"}
	case has("i2v"):
		return "video", []string{"image_to_video"}
	case has("t2v"):
		return "video", []string{"text_to_video"}
	case has("seedance", "kling", "hailuo", "vidu"):
		return "video", []string{"text_to_video", "image_to_video"}
	case has("veo", "sora", "video"):
		return "video", []string{"text_to_video"}
	case has("imageedit", "image-edit", "image_edit", "-edit"):
		return "image", []string{"image_to_image", "image_edit"}
	case has("t2i"):
		return "image", []string{"text_to_image"}
	case has("image", "banana", "seedream", "flux", "midjourney", "dall"):
		return "image", []string{"text_to_image", "image_to_image"}
	case has("embed", "rerank"):
		return "text", []string{"text_generation"}
	case has("gpt", "qwen", "deepseek", "glm", "claude", "gemini", "kimi", "moonshot", "doubao", "llama", "ernie", "chat", "turbo", "max", "plus"):
		return "text", []string{"text_generation"}
	}
	return "image", []string{"text_to_image"}
}

type DiscoveredModel struct {
	ID           string   `json:"id"`
	Modality     string   `json:"modality"`
	Capabilities []string `json:"capabilities"`
	Inputs       []string `json:"inputs"`
	Outputs      []string `json:"outputs"`
	Enabled      bool     `json:"enabled"`
	LogicalKey   string   `json:"logicalKey,omitempty"`
}

// DiscoverDetailed lists the provider's models with a purpose suggestion and
// whether each one is already switched on for this channel.
func (s *Service) DiscoverDetailed(ctx context.Context, channelID string) ([]DiscoveredModel, error) {
	ids, err := s.DiscoverModels(ctx, channelID)
	if err != nil {
		return nil, err
	}
	enabled := map[string]string{}
	rows, err := s.pool.Query(ctx, `SELECT cm.provider_model_id, coalesce(l.key,'') FROM channel_models cm
		LEFT JOIN logical_model_abilities a ON a.channel_model_id=cm.id AND a.enabled
		LEFT JOIN logical_models l ON l.id=a.logical_model_id
		WHERE cm.channel_id=$1 AND cm.enabled`, channelID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id, key string
		if rows.Scan(&id, &key) == nil {
			enabled[id] = key
		}
	}
	rows.Close()
	out := make([]DiscoveredModel, 0, len(ids))
	for _, id := range ids {
		modality, caps := SuggestPurposes(id)
		inputs, outputs, _ := DeriveIO(caps)
		key, on := enabled[id]
		out = append(out, DiscoveredModel{ID: id, Modality: modality, Capabilities: caps, Inputs: inputs, Outputs: outputs, Enabled: on, LogicalKey: key})
	}
	slices.SortStableFunc(out, func(a, b DiscoveredModel) int {
		if a.Enabled != b.Enabled {
			if a.Enabled {
				return 1
			}
			return -1
		}
		return strings.Compare(a.Modality+a.ID, b.Modality+b.ID)
	})
	return out, nil
}

// MarkKeyRejected switches off a key the provider refused (401/403), so the
// next task uses another key and the model drops out of the client list when
// no usable key is left.
func (s *Service) MarkKeyRejected(ctx context.Context, keyID, code string) {
	if keyID == "" {
		return
	}
	if code == "" {
		code = "AUTH_FAILED"
	}
	_ = s.keys.DisableKey(ctx, keyID, code)
	_, _ = s.pool.Exec(ctx, `UPDATE provider_channels SET last_error=$2, updated_at=now() WHERE id=(SELECT channel_id FROM channel_keys WHERE id=$1)`, keyID, "Key 被供应商拒绝："+code)
}

type KeyTest struct {
	OK        bool   `json:"ok"`
	Status    int    `json:"status"`
	LatencyMS int64  `json:"latencyMs"`
	Message   string `json:"message"`
	Models    int    `json:"models"`
}

// TestKey calls the provider's model list with one key: cheap, no generation.
func (s *Service) TestKey(ctx context.Context, keyID string) (KeyTest, error) {
	key, channelID, err := s.keys.KeyByID(ctx, keyID)
	if err != nil {
		return KeyTest{}, err
	}
	var provider, base, modelsURL string
	if err := s.pool.QueryRow(ctx, `SELECT provider_code, coalesce(base_url,''), models_url FROM provider_channels WHERE id=$1`, channelID).Scan(&provider, &base, &modelsURL); err != nil {
		return KeyTest{}, &generation.APIError{Code: "NOT_FOUND", Message: "渠道不存在", Status: 404}
	}
	endpoint := ModelsEndpoint(provider, base, modelsURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return KeyTest{}, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	started := time.Now()
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	result := KeyTest{LatencyMS: time.Since(started).Milliseconds()}
	if err != nil {
		result.Message = "无法连接供应商：" + endpoint
		return result, nil
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	result.Status = resp.StatusCode
	switch {
	case resp.StatusCode == 401 || resp.StatusCode == 403:
		result.Message = "Key 无效或无权限（供应商返回 " + fmt.Sprint(resp.StatusCode) + "）"
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		result.OK, result.Models = true, len(ParseModelIDs(raw))
		result.Message = fmt.Sprintf("连接正常，%s 返回 %d 个模型", endpoint, result.Models)
	default:
		result.Message = fmt.Sprintf("供应商返回 %d", resp.StatusCode)
	}
	return result, nil
}

// ModelsEndpoint is where a channel's model list lives: the channel's own
// models URL when the provider hosts it elsewhere, else <base>/models.
func ModelsEndpoint(provider, base, modelsURL string) string {
	if strings.TrimSpace(modelsURL) != "" {
		return strings.TrimSpace(modelsURL)
	}
	return strings.TrimRight(modelsBase(provider, base), "/") + "/models"
}

// ParseModelIDs reads model ids from an OpenAI-style {"data":[{"id":..}]}
// list, also accepting "models" arrays and "model"/"model_name" fields.
func ParseModelIDs(raw []byte) []string {
	var payload struct {
		Data   []map[string]any `json:"data"`
		Models []map[string]any `json:"models"`
	}
	_ = json.Unmarshal(raw, &payload)
	ids := []string{}
	seen := map[string]bool{}
	for _, row := range append(payload.Data, payload.Models...) {
		for _, field := range []string{"id", "model", "model_name", "name"} {
			if value, ok := row[field].(string); ok && strings.TrimSpace(value) != "" {
				if !seen[value] {
					seen[value] = true
					ids = append(ids, value)
				}
				break
			}
		}
	}
	return ids
}

// modelsBase is the OpenAI-compatible root that serves GET /models.
func modelsBase(provider, base string) string {
	if provider == "dashscope" {
		if base == "" {
			base = "https://dashscope.aliyuncs.com/api/v1"
		}
		return strings.Replace(strings.TrimRight(base, "/"), "/api/v1", "/compatible-mode/v1", 1)
	}
	if base != "" {
		return base
	}
	switch provider {
	case "volcengine":
		return "https://ark.cn-beijing.volces.com/api/v3"
	case "computrix":
		return "https://maas-api.computrix.ai/v1"
	}
	return "https://maas-api.antdigital.com/v1"
}

type ModelHealth struct {
	Key          string     `json:"key"`
	DisplayName  string     `json:"displayName"`
	Description  string     `json:"description"`
	Modality     string     `json:"modality"`
	Capabilities []string   `json:"capabilities"`
	Inputs       []string   `json:"inputs"`
	Outputs      []string   `json:"outputs"`
	Tags         []string   `json:"tags"`
	Enabled      bool       `json:"enabled"`
	SortOrder    int        `json:"sortOrder"`
	Credits      int64      `json:"credits"`
	Bindings     int        `json:"bindings"`
	Usable       int        `json:"usable"`
	Providers    []string   `json:"providers"`
	Success24h   int        `json:"success24h"`
	Failed24h    int        `json:"failed24h"`
	LastError    string     `json:"lastError"`
	LastErrorAt  *time.Time `json:"lastErrorAt"`
	Reason       string     `json:"reason"`
}

type ChannelHealth struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Provider     string     `json:"provider"`
	Enabled      bool       `json:"enabled"`
	Keys         int        `json:"keys"`
	EnabledKeys  int        `json:"enabledKeys"`
	RejectedKeys int        `json:"rejectedKeys"`
	Cooldown     *time.Time `json:"cooldownUntil"`
	LastError    string     `json:"lastError"`
	Success24h   int        `json:"success24h"`
	Failed24h    int        `json:"failed24h"`
	Status       string     `json:"status"`
}

type Health struct {
	Models   []ModelHealth   `json:"models"`
	Channels []ChannelHealth `json:"channels"`
}

// usableBinding is the same rule List uses to count a channel as available.
const usableBinding = `a.enabled AND c.enabled AND cm.enabled AND (a.cooldown_until IS NULL OR a.cooldown_until < now()) AND (l.modality <> 'video' OR c.provider_code IN ('dashscope','volcengine')) AND EXISTS (SELECT 1 FROM channel_keys k WHERE k.channel_id=c.id AND k.enabled)`

// Health answers "can customers use this model, and if not why" in one call.
func (s *Service) Health(ctx context.Context) (Health, error) {
	var out Health
	rows, err := s.pool.Query(ctx, `SELECT l.key,l.display_name,l.description,l.modality,l.capabilities,l.tags,l.enabled,l.sort_order,l.credits_cost,
		count(a.id), count(a.id) FILTER (WHERE `+usableBinding+`),
		coalesce(array_agg(DISTINCT c.provider_code) FILTER (WHERE c.provider_code IS NOT NULL), '{}'),
		(SELECT count(*) FROM model_route_logs r WHERE r.logical_model_key=l.key AND r.status='success' AND r.created_at>now()-interval '24 hours'),
		(SELECT count(*) FROM model_route_logs r WHERE r.logical_model_key=l.key AND r.status='failed' AND r.created_at>now()-interval '24 hours'),
		coalesce((SELECT r.error_code FROM model_route_logs r WHERE r.logical_model_key=l.key AND r.status='failed' ORDER BY r.created_at DESC LIMIT 1),''),
		(SELECT max(r.created_at) FROM model_route_logs r WHERE r.logical_model_key=l.key AND r.status='failed')
		FROM logical_models l
		LEFT JOIN logical_model_abilities a ON a.logical_model_id=l.id
		LEFT JOIN channel_models cm ON cm.id=a.channel_model_id
		LEFT JOIN provider_channels c ON c.id=cm.channel_id
		GROUP BY l.id ORDER BY l.modality, l.sort_order, l.display_name`)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var m ModelHealth
		var caps, tags []byte
		if err := rows.Scan(&m.Key, &m.DisplayName, &m.Description, &m.Modality, &caps, &tags, &m.Enabled, &m.SortOrder, &m.Credits, &m.Bindings, &m.Usable, &m.Providers, &m.Success24h, &m.Failed24h, &m.LastError, &m.LastErrorAt); err != nil {
			rows.Close()
			return out, err
		}
		_ = json.Unmarshal(caps, &m.Capabilities)
		_ = json.Unmarshal(tags, &m.Tags)
		if m.Tags == nil {
			m.Tags = []string{}
		}
		m.Inputs, m.Outputs, _ = DeriveIO(m.Capabilities)
		m.Reason = modelReason(m)
		out.Models = append(out.Models, m)
	}
	rows.Close()
	rows, err = s.pool.Query(ctx, `SELECT c.id::text,c.name,c.provider_code,c.enabled,
		(SELECT count(*) FROM channel_keys k WHERE k.channel_id=c.id),
		(SELECT count(*) FROM channel_keys k WHERE k.channel_id=c.id AND k.enabled),
		(SELECT count(*) FROM channel_keys k WHERE k.channel_id=c.id AND NOT k.enabled AND k.disabled_reason<>''),
		c.cooldown_until, coalesce(c.last_error,''),
		(SELECT count(*) FROM model_route_logs r WHERE r.channel_id=c.id AND r.status='success' AND r.created_at>now()-interval '24 hours'),
		(SELECT count(*) FROM model_route_logs r WHERE r.channel_id=c.id AND r.status='failed' AND r.created_at>now()-interval '24 hours')
		FROM provider_channels c ORDER BY c.enabled DESC, c.provider_code, c.priority DESC`)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var c ChannelHealth
		if err := rows.Scan(&c.ID, &c.Name, &c.Provider, &c.Enabled, &c.Keys, &c.EnabledKeys, &c.RejectedKeys, &c.Cooldown, &c.LastError, &c.Success24h, &c.Failed24h); err != nil {
			return out, err
		}
		c.Status = channelStatus(c, s.now())
		out.Channels = append(out.Channels, c)
	}
	return out, rows.Err()
}

func channelStatus(c ChannelHealth, now time.Time) string {
	switch {
	case !c.Enabled:
		return "disabled"
	case c.EnabledKeys == 0 && c.RejectedKeys > 0:
		return "auth_failed"
	case c.EnabledKeys == 0:
		return "no_key"
	case c.Cooldown != nil && c.Cooldown.After(now):
		return "cooldown"
	case c.RejectedKeys > 0:
		return "degraded"
	}
	return "ok"
}

func modelReason(m ModelHealth) string {
	switch {
	case !m.Enabled:
		return "hidden"
	case m.Bindings == 0:
		return "no_channel"
	case m.Usable == 0 && m.Modality == "video" && !slices.ContainsFunc(m.Providers, func(p string) bool { return p == "volcengine" || p == "dashscope" }):
		return "video_provider_unsupported"
	case m.Usable == 0:
		return "no_usable_channel"
	case m.Usable == 1:
		return "single_channel"
	}
	return "ok"
}

type LogicalPatch struct {
	DisplayName  *string   `json:"displayName"`
	Description  *string   `json:"description"`
	Capabilities *[]string `json:"capabilities"`
	Tags         *[]string `json:"tags"`
	Enabled      *bool     `json:"enabled"`
	SortOrder    *int      `json:"sortOrder"`
}

// UpdateLogical edits what customers see for a model: name, purposes, tags,
// visibility and order. Price stays on the pricing page.
func (s *Service) UpdateLogical(ctx context.Context, key string, patch LogicalPatch) error {
	invalid := func(message string) error {
		return &generation.APIError{Code: "INVALID_REQUEST", Message: message, Status: 400}
	}
	if patch.DisplayName != nil && (strings.TrimSpace(*patch.DisplayName) == "" || len([]rune(*patch.DisplayName)) > 60) {
		return invalid("显示名不能为空且不超过 60 字")
	}
	if patch.Description != nil && len([]rune(*patch.Description)) > 200 {
		return invalid("说明不超过 200 字")
	}
	var caps, tags, inputsJSON, outputsJSON []byte
	var primary *string
	if patch.Capabilities != nil {
		if len(*patch.Capabilities) == 0 {
			return invalid("至少选择一个用途")
		}
		for _, c := range *patch.Capabilities {
			if !slices.Contains(Purposes, c) {
				return invalid("未知用途：" + c)
			}
		}
		caps, _ = json.Marshal(*patch.Capabilities)
		inputs, outputs, main := DeriveIO(*patch.Capabilities)
		inputsJSON, _ = json.Marshal(inputs)
		outputsJSON, _ = json.Marshal(outputs)
		primary = &main
	}
	if patch.Tags != nil {
		if len(*patch.Tags) > 6 {
			return invalid("特点标签最多 6 个")
		}
		cleaned := []string{}
		for _, t := range *patch.Tags {
			if t = strings.TrimSpace(t); t != "" && len([]rune(t)) <= 12 {
				cleaned = append(cleaned, t)
			}
		}
		tags, _ = json.Marshal(cleaned)
	}
	var name, description *string
	if patch.DisplayName != nil {
		v := strings.TrimSpace(*patch.DisplayName)
		name = &v
	}
	if patch.Description != nil {
		v := strings.TrimSpace(*patch.Description)
		description = &v
	}
	tag, err := s.pool.Exec(ctx, `UPDATE logical_models SET
		display_name=COALESCE($2,display_name), description=COALESCE($3,description),
		capabilities=COALESCE($4::jsonb,capabilities), tags=COALESCE($5::jsonb,tags),
		enabled=COALESCE($6,enabled), sort_order=COALESCE($7,sort_order),
		input_modalities=COALESCE($8::jsonb,input_modalities), output_modalities=COALESCE($9::jsonb,output_modalities), modality=COALESCE($10,modality)
		WHERE key=$1`, key, name, description, nullJSON(caps), nullJSON(tags), patch.Enabled, patch.SortOrder, nullJSON(inputsJSON), nullJSON(outputsJSON), primary)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return &generation.APIError{Code: "NOT_FOUND", Message: "模型不存在", Status: 404}
	}
	return nil
}

func nullJSON(raw []byte) *string {
	if raw == nil {
		return nil
	}
	v := string(raw)
	return &v
}

type LogFilter struct {
	Model   string
	Channel string
	Status  string
	Code    string
	Hours   int
	Limit   int
}

type LogRow struct {
	CreatedAt   time.Time `json:"createdAt"`
	TaskID      string    `json:"taskId"`
	Model       string    `json:"model"`
	ProviderID  string    `json:"providerModelId"`
	ChannelID   string    `json:"channelId"`
	ChannelName string    `json:"channelName"`
	KeyLast4    string    `json:"keyLast4"`
	Attempt     int       `json:"attempt"`
	Status      string    `json:"status"`
	ErrorCode   string    `json:"errorCode"`
	LatencyMS   int64     `json:"latencyMs"`
	UserEmail   string    `json:"userEmail"`
}

type LogSummary struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Count  int    `json:"count"`
	Failed int    `json:"failed"`
}

type LogResult struct {
	Items     []LogRow     `json:"items"`
	ByCode    []LogSummary `json:"byCode"`
	ByChannel []LogSummary `json:"byChannel"`
	ByModel   []LogSummary `json:"byModel"`
}

// Logs returns filtered channel calls plus failure counts by code, channel and model.
func (s *Service) Logs(ctx context.Context, f LogFilter) (LogResult, error) {
	if f.Hours <= 0 || f.Hours > 24*30 {
		f.Hours = 24
	}
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 200
	}
	where := `r.created_at > now() - make_interval(hours=>$1) AND ($2='' OR r.logical_model_key=$2) AND ($3='' OR r.channel_id::text=$3) AND ($4='' OR r.status=$4) AND ($5='' OR r.error_code=$5)`
	args := []any{f.Hours, f.Model, f.Channel, f.Status, f.Code}
	out := LogResult{Items: []LogRow{}, ByCode: []LogSummary{}, ByChannel: []LogSummary{}, ByModel: []LogSummary{}}
	rows, err := s.pool.Query(ctx, `SELECT r.created_at, coalesce(r.task_id::text,''), coalesce(r.logical_model_key,''), coalesce(r.provider_model_id,''),
		coalesce(r.channel_id::text,''), coalesce(c.name,''), coalesce(k.key_last4,''), r.attempt, r.status, coalesce(r.error_code,''), coalesce(r.latency_ms,0), coalesce(u.email,'')
		FROM model_route_logs r
		LEFT JOIN provider_channels c ON c.id=r.channel_id
		LEFT JOIN channel_keys k ON k.id=r.key_id
		LEFT JOIN tasks t ON t.id=r.task_id
		LEFT JOIN users u ON u.id=t.user_id
		WHERE `+where+` ORDER BY r.created_at DESC LIMIT `+fmt.Sprint(f.Limit), args...)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var row LogRow
		if err := rows.Scan(&row.CreatedAt, &row.TaskID, &row.Model, &row.ProviderID, &row.ChannelID, &row.ChannelName, &row.KeyLast4, &row.Attempt, &row.Status, &row.ErrorCode, &row.LatencyMS, &row.UserEmail); err != nil {
			rows.Close()
			return out, err
		}
		out.Items = append(out.Items, row)
	}
	rows.Close()
	summary := func(group, label string) ([]LogSummary, error) {
		rows, err := s.pool.Query(ctx, `SELECT `+group+`, `+label+`, count(*), count(*) FILTER (WHERE r.status='failed')
			FROM model_route_logs r LEFT JOIN provider_channels c ON c.id=r.channel_id WHERE `+where+`
			GROUP BY 1,2 ORDER BY 4 DESC, 3 DESC LIMIT 20`, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		list := []LogSummary{}
		for rows.Next() {
			var item LogSummary
			if err := rows.Scan(&item.Key, &item.Label, &item.Count, &item.Failed); err != nil {
				return nil, err
			}
			list = append(list, item)
		}
		return list, rows.Err()
	}
	if out.ByCode, err = summary(`coalesce(nullif(r.error_code,''),'OK')`, `coalesce(nullif(r.error_code,''),'OK')`); err != nil {
		return out, err
	}
	if out.ByChannel, err = summary(`coalesce(r.channel_id::text,'')`, `coalesce(c.name,'未知渠道')`); err != nil {
		return out, err
	}
	out.ByModel, err = summary(`coalesce(r.logical_model_key,'')`, `coalesce(r.logical_model_key,'')`)
	return out, err
}
