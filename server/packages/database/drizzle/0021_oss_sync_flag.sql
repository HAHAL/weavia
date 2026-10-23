-- 客户端 OSS 同步开关由后端按账户授权，客户端只能读取、不能自行开启。
ALTER TABLE users ADD COLUMN IF NOT EXISTS oss_sync_enabled boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS oss_sync_enabled_at timestamptz;--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS oss_sync_enabled_by uuid REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
