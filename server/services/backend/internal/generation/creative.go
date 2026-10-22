package generation

import (
	"strings"
)

// CreativeBrief is a snapshot of the operator's intent at submission time.
// Product records in the desktop client remain local; this snapshot makes the
// generated task understandable after a restart or on another device.
type CreativeBrief struct {
	Purpose  string           `json:"purpose"`
	Channel  string           `json:"channel"`
	Market   string           `json:"market"`
	Language string           `json:"language"`
	Audience string           `json:"audience,omitempty"`
	Product  *CreativeProduct `json:"product,omitempty"`
}

type CreativeProduct struct {
	LocalID         string `json:"localId,omitempty"`
	Name            string `json:"name"`
	SKU             string `json:"sku,omitempty"`
	Description     string `json:"description,omitempty"`
	VerifiedFacts   string `json:"verifiedFacts,omitempty"`
	ForbiddenClaims string `json:"forbiddenClaims,omitempty"`
}

func prepareCreative(input *Request) error {
	brief := input.Creative
	if brief == nil {
		return nil
	}
	brief.Purpose = strings.TrimSpace(brief.Purpose)
	brief.Channel = strings.TrimSpace(brief.Channel)
	brief.Market = strings.TrimSpace(brief.Market)
	brief.Language = strings.TrimSpace(brief.Language)
	brief.Audience = strings.TrimSpace(brief.Audience)
	allowed := map[string]bool{"hero": true, "scene": true, "ad": true, "video": true}
	if !allowed[brief.Purpose] || len(brief.Channel) > 80 || len(brief.Market) > 80 || len(brief.Language) > 32 || len(brief.Audience) > 300 {
		return &APIError{"INVALID_CREATIVE_BRIEF", "创作目标或投放信息无效", 400}
	}
	if brief.Channel == "" || brief.Market == "" || brief.Language == "" {
		return &APIError{"INVALID_CREATIVE_BRIEF", "请填写渠道、市场和语言", 400}
	}
	if input.Mode == "text_to_video" || input.Mode == "image_to_video" {
		if brief.Purpose != "video" {
			return &APIError{"INVALID_CREATIVE_BRIEF", "视频任务需要选择视频创作目标", 400}
		}
	} else if brief.Purpose == "video" {
		return &APIError{"INVALID_CREATIVE_BRIEF", "图片任务不能使用视频创作目标", 400}
	}
	if brief.Product != nil {
		product := brief.Product
		product.Name = strings.TrimSpace(product.Name)
		product.SKU = strings.TrimSpace(product.SKU)
		product.Description = strings.TrimSpace(product.Description)
		product.VerifiedFacts = strings.TrimSpace(product.VerifiedFacts)
		product.ForbiddenClaims = strings.TrimSpace(product.ForbiddenClaims)
		if product.Name == "" || len(product.Name) > 160 || len(product.SKU) > 100 || len(product.Description) > 2000 || len(product.VerifiedFacts) > 2000 || len(product.ForbiddenClaims) > 2000 {
			return &APIError{"INVALID_CREATIVE_BRIEF", "商品资料不完整或过长", 400}
		}
		if brief.Purpose != "video" && len(input.ReferenceAssets) == 0 {
			return &APIError{"SOURCE_IMAGE_REQUIRED", "商品图片创作需要先上传商品依据图", 400}
		}
	}
	var lines []string
	lines = append(lines, "创作目标："+map[string]string{"hero": "商品上架主图", "scene": "商品场景营销图", "ad": "商品宣传图", "video": "商品宣传视频"}[brief.Purpose])
	lines = append(lines, "目标渠道："+brief.Channel, "目标市场："+brief.Market, "输出语言："+brief.Language)
	if brief.Audience != "" {
		lines = append(lines, "目标人群："+brief.Audience)
	}
	if product := brief.Product; product != nil {
		lines = append(lines, "商品名称："+product.Name)
		if product.SKU != "" {
			lines = append(lines, "SKU："+product.SKU)
		}
		if product.Description != "" {
			lines = append(lines, "商品描述："+product.Description)
		}
		if product.VerifiedFacts != "" {
			lines = append(lines, "已核实事实（只能据此陈述商品属性）："+product.VerifiedFacts)
		}
		if product.ForbiddenClaims != "" {
			lines = append(lines, "禁止声明："+product.ForbiddenClaims)
		}
	}
	lines = append(lines, "保留参考图中的商品外观、包装、Logo 和可见文字；不要编造商品功效、认证、价格或促销承诺。生成结果必须经运营人员核对后使用。")
	input.Prompt = strings.TrimSpace(input.Prompt) + "\n\n[电商创作资料]\n" + strings.Join(lines, "\n")
	return nil
}
