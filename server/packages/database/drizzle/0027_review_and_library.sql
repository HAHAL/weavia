-- 客户审阅链接：把一批成功的任务结果发给品牌方逐张确认；以及商品库云端备份。
CREATE TABLE IF NOT EXISTS review_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS review_links_user_idx ON review_links (user_id, created_at DESC);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS review_decisions (
  link_id uuid NOT NULL REFERENCES review_links(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','changes')),
  note text NOT NULL DEFAULT '',
  reviewer text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, item_key)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS user_products (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_id text NOT NULL,
  data jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_id)
);
--> statement-breakpoint
-- 视频复刻：拆解用的多模态模型（OpenAI 兼容），按渠道 provider_code 取 Key。
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS vision_provider text NOT NULL DEFAULT 'volcengine';--> statement-breakpoint
ALTER TABLE client_config ADD COLUMN IF NOT EXISTS vision_model text NOT NULL DEFAULT '';--> statement-breakpoint
-- 图生视频：这些模型支持首帧图输入。
UPDATE logical_models SET capabilities = capabilities || '["image_to_video"]'::jsonb
WHERE key IN ('doubao-seedance-2-0-fast-260128','doubao-seedance-2-5-260628','doubao-seedance-1-5-pro-251215','wan2.7-i2v','happyhorse-1.0-i2v','happyhorse-1.1-i2v')
  AND NOT capabilities ? 'image_to_video';
