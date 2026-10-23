-- 定价与成本：厂商原价、汇率、最低毛利率，用于前台售价与亏损拦截。
CREATE TABLE IF NOT EXISTS billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  credit_cny_rate numeric(12,4) NOT NULL DEFAULT 5.0000 CHECK (credit_cny_rate > 0),
  fx_usd_cny numeric(12,4) NOT NULL DEFAULT 7.1000 CHECK (fx_usd_cny > 0),
  min_margin_rate numeric(6,4) NOT NULL DEFAULT 0.5000 CHECK (min_margin_rate >= 0 AND min_margin_rate < 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
INSERT INTO billing_settings(id) VALUES (true) ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS cost_amount numeric(12,4) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS cost_currency text NOT NULL DEFAULT 'CNY';--> statement-breakpoint
ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS cost_unit text NOT NULL DEFAULT 'per_image';--> statement-breakpoint
ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS tax_included boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS cost_verified boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS cost_source text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS cost_note text NOT NULL DEFAULT '';--> statement-breakpoint

-- 已核实的阿里云百炼公开标价（华北2，元/张，含税）。
UPDATE channel_models
SET cost_amount = 0.2000, cost_currency = 'CNY', cost_unit = 'per_image', tax_included = true,
    cost_verified = true, cost_source = 'https://help.aliyun.com/zh/model-studio/qwen-image-2-0'
WHERE provider_model_id = 'qwen-image-2.0' AND cost_verified = false;--> statement-breakpoint

UPDATE channel_models
SET cost_amount = 0.2000, cost_currency = 'CNY', cost_unit = 'per_image', tax_included = true,
    cost_verified = true, cost_source = 'https://help.aliyun.com/zh/model-studio/wan2-7-image'
WHERE provider_model_id = 'wan2.7-image' AND cost_verified = false;--> statement-breakpoint
