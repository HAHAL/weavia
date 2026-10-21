-- Multi-channel routing: channels, keys, channel models, logical models, abilities.
CREATE TABLE IF NOT EXISTS provider_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text NOT NULL,
  name text NOT NULL,
  base_url text NOT NULL DEFAULT '',
  group_name text NOT NULL DEFAULT 'default',
  priority integer NOT NULL DEFAULT 0,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 0),
  enabled boolean NOT NULL DEFAULT true,
  auto_disable boolean NOT NULL DEFAULT true,
  failure_threshold integer NOT NULL DEFAULT 3,
  cooldown_seconds integer NOT NULL DEFAULT 60,
  consecutive_failures integer NOT NULL DEFAULT 0,
  cooldown_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_code, name)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS channel_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES provider_channels(id) ON DELETE CASCADE,
  encrypted_key bytea NOT NULL,
  key_last4 text NOT NULL,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 0),
  enabled boolean NOT NULL DEFAULT true,
  consecutive_failures integer NOT NULL DEFAULT 0,
  cooldown_until timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS channel_keys_channel_idx ON channel_keys(channel_id);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS channel_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES provider_channels(id) ON DELETE CASCADE,
  provider_model_id text NOT NULL,
  display_name text NOT NULL,
  modality text NOT NULL DEFAULT 'image' CHECK (modality IN ('image','video')),
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, provider_model_id)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS logical_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  type text NOT NULL DEFAULT 'image',
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'sparkles';--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'image';--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS credits_cost bigint NOT NULL DEFAULT 10;--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;--> statement-breakpoint
ALTER TABLE channel_keys ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE channel_keys ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();--> statement-breakpoint
CREATE TABLE IF NOT EXISTS logical_model_abilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_model_id uuid NOT NULL REFERENCES logical_models(id) ON DELETE CASCADE,
  channel_model_id uuid NOT NULL REFERENCES channel_models(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 0),
  enabled boolean NOT NULL DEFAULT true,
  health text NOT NULL DEFAULT 'healthy' CHECK (health IN ('healthy','degraded','cooldown','disabled')),
  failure_count integer NOT NULL DEFAULT 0,
  cooldown_until timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(logical_model_id, channel_model_id)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS model_route_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid,
  logical_model_key text NOT NULL,
  channel_id uuid,
  channel_model_id uuid,
  provider_model_id text,
  attempt integer NOT NULL DEFAULT 1,
  status text NOT NULL,
  error_code text,
  latency_ms integer NOT NULL DEFAULT 0,
  provider_cost double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS model_route_logs_task_idx ON model_route_logs(task_id, created_at DESC);--> statement-breakpoint

INSERT INTO provider_channels(provider_code,name,base_url,priority,weight,enabled)
SELECT code,name,base_url,100,1,enabled FROM ai_providers
ON CONFLICT(provider_code,name) DO NOTHING;--> statement-breakpoint

INSERT INTO channel_keys(channel_id,encrypted_key,key_last4,updated_by,updated_at)
SELECT c.id,pc.encrypted_key,pc.key_last4,pc.updated_by,pc.updated_at
FROM provider_credentials pc
JOIN provider_channels c ON c.provider_code=pc.provider_code
WHERE NOT EXISTS (SELECT 1 FROM channel_keys k WHERE k.channel_id=c.id);--> statement-breakpoint

INSERT INTO channel_models(channel_id,provider_model_id,display_name,modality,capabilities,metadata,enabled,last_synced_at)
SELECT c.id,m.model_name,coalesce(m.display_name,m.model_name),
  CASE WHEN m.capabilities::text LIKE '%video%' THEN 'video' ELSE 'image' END,
  m.capabilities,m.metadata,m.enabled,now()
FROM ai_models m JOIN provider_channels c ON c.provider_code=m.provider
WHERE m.model_name IS NOT NULL
ON CONFLICT(channel_id,provider_model_id) DO NOTHING;--> statement-breakpoint

INSERT INTO logical_models(key,display_name,type,icon,modality,capabilities,credits_cost,params,enabled,sort_order)
SELECT m.model_name,coalesce(m.display_name,m.model_name),
  CASE WHEN m.capabilities::text LIKE '%video%' THEN 'video' ELSE 'image' END,
  CASE WHEN m.model_name LIKE '%edit%' THEN 'wand' WHEN m.model_name LIKE '%max%' THEN 'crown' ELSE 'sparkles' END,
  CASE WHEN m.capabilities::text LIKE '%video%' THEN 'video' ELSE 'image' END,
  m.capabilities,m.credit_cost,
  '{"ratios":["1:1","4:5","3:4","16:9","9:16"],"resolutions":["1K","2K"],"maxCount":4,"promptExtend":true}'::jsonb,
  m.enabled,100
FROM ai_models m WHERE m.model_name IS NOT NULL
ON CONFLICT(key) DO UPDATE SET display_name=EXCLUDED.display_name,type=EXCLUDED.type,icon=EXCLUDED.icon,modality=EXCLUDED.modality,capabilities=EXCLUDED.capabilities,credits_cost=EXCLUDED.credits_cost,params=EXCLUDED.params,enabled=EXCLUDED.enabled;--> statement-breakpoint

INSERT INTO logical_model_abilities(logical_model_id,channel_model_id,priority,weight,enabled)
SELECT l.id,cm.id,c.priority,c.weight,true
FROM logical_models l
JOIN channel_models cm ON cm.provider_model_id=l.key
JOIN provider_channels c ON c.id=cm.channel_id
WHERE NOT EXISTS (SELECT 1 FROM logical_model_abilities a WHERE a.logical_model_id=l.id AND a.channel_model_id=cm.id);--> statement-breakpoint
