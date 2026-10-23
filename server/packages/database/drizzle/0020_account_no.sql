-- 账户业务 ID：全系统可查询，并作为对象存储的一级目录。
CREATE SEQUENCE IF NOT EXISTS user_account_no_seq START 100001;--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_no text;--> statement-breakpoint
UPDATE users SET account_no = 'WA' || lpad(nextval('user_account_no_seq')::text, 6, '0') WHERE account_no IS NULL;--> statement-breakpoint
ALTER TABLE users ALTER COLUMN account_no SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_account_no_key ON users (account_no);--> statement-breakpoint

-- 客户端素材的取用方式：走服务器代理，或走外部/CDN 域名。
ALTER TABLE storage_settings ADD COLUMN IF NOT EXISTS client_asset_mode text NOT NULL DEFAULT 'server';--> statement-breakpoint
ALTER TABLE storage_settings ADD COLUMN IF NOT EXISTS cdn_base_url text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE storage_settings ADD COLUMN IF NOT EXISTS sync_showcase boolean NOT NULL DEFAULT false;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storage_settings_client_asset_mode_check') THEN
    ALTER TABLE storage_settings ADD CONSTRAINT storage_settings_client_asset_mode_check CHECK (client_asset_mode IN ('server','cdn'));
  END IF;
END $$;--> statement-breakpoint
