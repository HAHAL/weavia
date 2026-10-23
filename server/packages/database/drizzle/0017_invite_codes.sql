-- 邀请码：注册必须持有有效邀请码，可控次数、有效期与启停。
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  note text NOT NULL DEFAULT '',
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses >= 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes (upper(code));--> statement-breakpoint
