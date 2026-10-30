-- 有些供应商把模型列表放在和生成接口不同的域名（如 Computrix：生成走 maas-api.computrix.ai，列表在 computrix.ai）。
ALTER TABLE provider_channels ADD COLUMN IF NOT EXISTS models_url text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE provider_channels SET models_url='https://computrix.ai/v1/models' WHERE provider_code='computrix' AND models_url='';
