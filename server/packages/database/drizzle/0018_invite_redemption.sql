-- 记录用户是通过哪个邀请码注册的，便于后台追溯渠道。
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code_id uuid REFERENCES invite_codes(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS users_invite_code_idx ON users (invite_code_id);--> statement-breakpoint
