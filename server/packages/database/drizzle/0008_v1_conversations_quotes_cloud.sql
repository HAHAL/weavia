-- WEAVIA V1: conversations, messages, quotes, invitations, storage packs, cloud works.
-- Additive and safe to execute again. P1a migration; apply with drizzle-kit migrate.
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '新会话',
  mode text NOT NULL DEFAULT 'image' CHECK (mode IN ('image','video')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversations_user_updated_idx ON conversations(user_id, updated_at DESC);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_message_id text,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS messages_task_idx ON messages(task_id);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_unique ON messages(conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'credits' CHECK (currency = 'credits'),
  total_credits bigint NOT NULL CHECK (total_credits > 0),
  line_items jsonb NOT NULL,
  request jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quotes_user_status_expires_idx ON quotes(user_id, status, expires_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quotes_conversation_idx ON quotes(conversation_id);--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mode text;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS edit_mode text CHECK (edit_mode IS NULL OR edit_mode IN ('whole','region'));--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mask_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_plan jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS provider_endpoint text;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS provider_task_id text;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_expires_at timestamptz;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_conversation_created_idx ON tasks(conversation_id, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_message_idx ON tasks(message_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks(parent_task_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_output_expires_idx ON tasks(output_expires_at) WHERE output_expires_at IS NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
  disabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invitation_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invitation_id, user_id)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS storage_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  bytes bigint NOT NULL CHECK (bytes > 0),
  price_minor integer NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'CNY',
  duration_days integer NOT NULL CHECK (duration_days > 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS storage_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES storage_packs(id),
  bytes bigint NOT NULL CHECK (bytes > 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS storage_entitlements_user_status_idx ON storage_entitlements(user_id, status, expires_at);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cloud_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  local_work_id text NOT NULL,
  title text NOT NULL,
  cover_key text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, local_work_id)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cloud_works_user_updated_idx ON cloud_works(user_id, updated_at DESC);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cloud_work_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_work_id uuid NOT NULL REFERENCES cloud_works(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  prompt text NOT NULL DEFAULT '',
  asset_key text NOT NULL,
  mime text NOT NULL,
  size bigint NOT NULL CHECK (size > 0),
  source_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cloud_work_id, version_no)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cloud_work_versions_work_idx ON cloud_work_versions(cloud_work_id, version_no);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cloud_storage_usage (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bytes_used bigint NOT NULL DEFAULT 0 CHECK (bytes_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_v1_free_grant_unique
  ON credit_transactions_v1(account_id, reference_type, reference_id)
  WHERE reference_type = 'free_plan';--> statement-breakpoint
INSERT INTO ai_models(provider_id,external_id,display_name,capabilities,pricing,enabled,model_name,provider,credit_cost,metadata)
SELECT p.id, seed.model_name, seed.display_name, seed.capabilities::jsonb, '{}'::jsonb, true, seed.model_name, seed.provider, seed.credit_cost, seed.metadata::jsonb
FROM (VALUES
 ('wan2.7-image','Wan2.7 Image','dashscope',40,'["text_to_image","image_to_image","image_edit"]','{"maxReferences":4,"supportsMask":false}'),
 ('qwen-image-2.1-pro','Qwen Image 2.1 Pro','dashscope',45,'["text_to_image","image_to_image","image_edit"]','{"maxReferences":3,"supportsMask":false}'),
 ('wanx2.1-imageedit','Wan2.1 Image Edit','dashscope',50,'["image_to_image","image_edit"]','{"maxReferences":1,"supportsMask":true}')
) AS seed(model_name,display_name,provider,credit_cost,capabilities,metadata)
JOIN ai_providers p ON p.code=seed.provider
ON CONFLICT(provider_id,external_id) DO UPDATE SET model_name=excluded.model_name,provider=excluded.provider,credit_cost=excluded.credit_cost,metadata=excluded.metadata;--> statement-breakpoint
