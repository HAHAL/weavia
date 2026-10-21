package generation

import "github.com/weavia/weavia/services/backend/internal/auth"

type Model struct {
	ID           string         `json:"id"`
	ProviderID   string         `json:"providerId,omitempty"`
	ModelID      string         `json:"modelId,omitempty"`
	Name         string         `json:"name,omitempty"`
	DisplayName  string         `json:"displayName,omitempty"`
	Modality     string         `json:"modality,omitempty"`
	Capabilities []string       `json:"capabilities"`
	Enabled      bool           `json:"enabled"`
	Currency     string         `json:"currency,omitempty"`
	PricingUnit  string         `json:"pricingUnit,omitempty"`
	CreditsCost  int            `json:"creditsCost"`
	QualityLevel string         `json:"qualityLevel"`
	Advanced     bool           `json:"advanced"`
	Metadata     map[string]any `json:"metadata,omitempty"`
}
type Provider struct {
	ID               string  `json:"id"`
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	Type             string  `json:"type"`
	BaseURL          string  `json:"baseUrl"`
	Enabled          bool    `json:"enabled"`
	Configured       bool    `json:"configured"`
	CreatedAt        string  `json:"createdAt"`
	UpdatedAt        string  `json:"updatedAt"`
	ModelCount       int     `json:"modelCount,omitempty"`
	Calls            int     `json:"calls"`
	Successes        int     `json:"successes"`
	Failures         int     `json:"failures"`
	SuccessRate      float64 `json:"successRate"`
	FailureRate      float64 `json:"failureRate"`
	AverageLatencyMS int     `json:"averageLatencyMs"`
	KeyLast4         string  `json:"keyLast4,omitempty"`
}
type LogicalModel struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	DisplayName string `json:"displayName"`
	Type        string `json:"type"`
	Enabled     bool   `json:"enabled"`
}
type Binding struct {
	ID              string `json:"id"`
	LogicalModelID  string `json:"logicalModelId"`
	ProviderModelID string `json:"providerModelId"`
	Priority        int    `json:"priority"`
	Enabled         bool   `json:"enabled"`
}
type Template struct {
	ID              string   `json:"id"`
	Category        string   `json:"category"`
	Scene           string   `json:"scene"`
	Style           string   `json:"style"`
	Prompt          string   `json:"prompt"`
	NegativePrompt  string   `json:"negativePrompt"`
	SupportedModels []string `json:"supportedModels"`
}

const providerID = "00000000-0000-4000-8000-000000000101"
const dashScopeProviderID = "00000000-0000-4000-8000-000000000105"

var Models = []Model{
	{ID: "00000000-0000-4000-8000-000000000102", ProviderID: providerID, ModelID: "qwen-image-max", DisplayName: "Qwen Image Max", Modality: "image", Capabilities: []string{"text_to_image"}, Enabled: true, Currency: "CNY", PricingUnit: "image", CreditsCost: 30, QualityLevel: "professional", Advanced: true, Metadata: map[string]any{"contract": "openai-compatible", "promptExtend": true, "estimatedSeconds": float64(45)}},
	{ID: "00000000-0000-4000-8000-000000000108", ProviderID: providerID, ModelID: "qwen-image-2.0", DisplayName: "Qwen Image 2.0", Modality: "image", Capabilities: []string{"text_to_image", "image_to_image"}, Enabled: true, Currency: "CNY", PricingUnit: "image", CreditsCost: 10, QualityLevel: "standard", Advanced: true, Metadata: map[string]any{"contract": "openai-compatible", "referenceField": "image", "maxReferences": 1, "estimatedSeconds": float64(30)}},
	{ID: "00000000-0000-4000-8000-000000000106", ProviderID: dashScopeProviderID, ModelID: "qwen-image-edit-plus", DisplayName: "Qwen Image Edit Plus", Modality: "image", Capabilities: []string{"image_to_image", "image_edit"}, Enabled: true, Currency: "CNY", PricingUnit: "image", CreditsCost: 50, QualityLevel: "flagship", Advanced: true, Metadata: map[string]any{"contract": "dashscope-multimodal", "maxReferenceImages": 3}},
}
var LogicalModels = []LogicalModel{{ID: "00000000-0000-4000-8000-000000000103", Key: "weavia-image-pro", DisplayName: "WEAVIA 专业", Type: "image", Enabled: true}}
var Bindings = []Binding{{ID: "00000000-0000-4000-8000-000000000104", LogicalModelID: LogicalModels[0].ID, ProviderModelID: Models[0].ID, Priority: 1, Enabled: true}, {ID: "00000000-0000-4000-8000-000000000109", LogicalModelID: LogicalModels[0].ID, ProviderModelID: Models[1].ID, Priority: 1, Enabled: true}, {ID: "00000000-0000-4000-8000-000000000107", LogicalModelID: LogicalModels[0].ID, ProviderModelID: Models[2].ID, Priority: 1, Enabled: true}}
var Templates = []Template{
	{ID: "fashion-brand-ad", Category: "女装", Scene: "高级品牌广告", Style: "自然光品牌大片", Prompt: "保持商品设计、颜色与材质一致，生成高级商业摄影，自然光，品牌广告风格。", NegativePrompt: "商品变形，错误文字，低清晰度，过度磨皮", SupportedModels: []string{"qwen-image-2.0", "qwen-image-max", "qwen-image-edit-plus"}},
	{ID: "shoe-sports-ad", Category: "鞋", Scene: "运动广告", Style: "动感棚拍", Prompt: "保持鞋款结构和标识一致，生成动感运动广告，专业棚拍光线，清晰材质细节。", NegativePrompt: "鞋型变形，多余鞋带，模糊，错误标识", SupportedModels: []string{"qwen-image-2.0", "qwen-image-edit-plus"}},
	{ID: "bag-luxury-ad", Category: "包", Scene: "奢侈品广告", Style: "极简高级", Prompt: "保持包款设计和五金细节一致，生成奢侈品商业广告，极简场景，精致专业布光。", NegativePrompt: "包型变形，五金错误，廉价质感，杂乱背景", SupportedModels: []string{"qwen-image-2.0", "qwen-image-max", "qwen-image-edit-plus"}},
}

func PublicCatalog(user auth.User) map[string]any {
	result := make([]Model, 0, len(Models))
	for _, m := range Models {
		caps := make([]string, len(m.Capabilities))
		for i, c := range m.Capabilities {
			if c == "text_to_image" {
				caps[i] = "image_generation"
			} else if c == "image_to_image" {
				caps[i] = "reference_image"
			} else {
				caps[i] = c
			}
		}
		result = append(result, Model{ID: m.ModelID, Name: m.DisplayName, Capabilities: caps, CreditsCost: m.CreditsCost, Enabled: m.Enabled, QualityLevel: m.QualityLevel, Advanced: m.Advanced})
	}
	return map[string]any{"models": result, "professionalAccess": user.Email == "demo@weavia.local"}
}

type APIError struct {
	Code, Message string
	Status        int
}

func (e *APIError) Error() string { return e.Message }
func Estimate(user auth.User, model string, count int, advanced bool) (map[string]any, error) {
	if count != 1 {
		return nil, &APIError{"INVALID_REQUEST", "Beta 当前仅支持单张生成", 400}
	}
	for _, m := range Models {
		if m.ModelID == model && m.Enabled {
			if advanced && m.Advanced && user.Email != "demo@weavia.local" {
				return nil, &APIError{"UNSUPPORTED_MODEL", "当前账户未开放高级模型", 403}
			}
			seconds := 60
			if model == "qwen-image-2.0" {
				seconds = 30
			} else if model == "qwen-image-max" {
				seconds = 45
			}
			return map[string]any{"credits": m.CreditsCost * count, "estimatedTime": seconds, "model": model}, nil
		}
	}
	return nil, &APIError{"UNSUPPORTED_MODEL", "模型不可用", 400}
}
