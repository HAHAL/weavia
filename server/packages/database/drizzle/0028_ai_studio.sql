-- AI Studio：Key 鉴权失败自动停用并留原因；逻辑模型增加给客户看的说明和特点标签。
ALTER TABLE channel_keys ADD COLUMN IF NOT EXISTS disabled_reason text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE channel_keys ADD COLUMN IF NOT EXISTS disabled_at timestamptz;--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS model_route_logs_created_idx ON model_route_logs (created_at DESC);
