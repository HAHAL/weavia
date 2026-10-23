-- 记录每次调用实际使用的 Key，用于按 Key 统计健康度。
ALTER TABLE model_route_logs ADD COLUMN IF NOT EXISTS key_id uuid REFERENCES channel_keys(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS model_route_logs_key_idx ON model_route_logs (key_id, created_at DESC);--> statement-breakpoint
