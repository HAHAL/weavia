-- 客户端运营：可在后台修改的 API 地址、强制升级版本、公告；灵感示例的一键同款参数。
CREATE TABLE IF NOT EXISTS client_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  api_base_url text NOT NULL DEFAULT '',
  min_version text NOT NULL DEFAULT '',
  latest_version text NOT NULL DEFAULT '',
  download_mac text NOT NULL DEFAULT '',
  download_windows text NOT NULL DEFAULT '',
  release_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
INSERT INTO client_config(id) VALUES (true) ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','important')),
  pinned boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS announcements_active_idx ON announcements (status, pinned DESC, created_at DESC);--> statement-breakpoint

ALTER TABLE showcase_items ADD COLUMN IF NOT EXISTS media text NOT NULL DEFAULT 'image';--> statement-breakpoint
ALTER TABLE showcase_items ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE showcase_items ADD COLUMN IF NOT EXISTS ratio text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE showcase_items ADD COLUMN IF NOT EXISTS resolution text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE showcase_items ADD COLUMN IF NOT EXISTS count integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE showcase_items ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;
