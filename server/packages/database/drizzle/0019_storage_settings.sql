-- 对象存储配置：默认本地磁盘；启用 OSS 后服务端走内网 endpoint，客户端不直连 OSS。
CREATE TABLE IF NOT EXISTS storage_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  provider text NOT NULL DEFAULT 'local' CHECK (provider IN ('local','oss')),
  bucket text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  endpoint_internal text NOT NULL DEFAULT '',
  endpoint_public text NOT NULL DEFAULT '',
  prefix text NOT NULL DEFAULT '',
  access_key_id text NOT NULL DEFAULT '',
  access_key_secret_enc bytea,
  verified_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
INSERT INTO storage_settings(id) VALUES (true) ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
