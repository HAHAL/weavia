-- WEAVIA V1 server DDL draft (PostgreSQL 17)
-- P0 only: review before converting to a Drizzle migration/journal entry.
-- Additive; does not drop existing tables.

-- 1) Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES workspaces(id) ON DELETE SET NULL,
  project_id uuid NULL REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '新会话',
  mode text NOT NULL DEFAULT 'image' CHECK (mode IN ('image','video')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_user_updated_idx ON conversations(user_id, updated_at DESC);

-- 2) Messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_message_id text,
  task_id uuid NULL REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_unique
  ON messages(conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;

-- 3) Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES workspaces(id) ON DELETE SET NULL,
  conversation_id uuid NULL REFERENCES conversations(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'credits' CHECK (currency = 'credits'),
  total_credits bigint NOT NULL CHECK (total_credits > 0),
  line_items jsonb NOT NULL,
  request jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS quotes_user_status_expires_idx ON quotes(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS quotes_conversation_idx ON quotes(conversation_id);

-- 4) Tasks extensions
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS edit_mode text CHECK (edit_mode IS NULL OR edit_mode IN ('whole','region'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mask_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_plan jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS provider_endpoint text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS provider_task_id text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS tasks_conversation_created_idx ON tasks(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_message_idx ON tasks(message_id);
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_output_expires_idx ON tasks(output_expires_at) WHERE output_expires_at IS NOT NULL;

-- 5) Invitations
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
);
CREATE TABLE IF NOT EXISTS invitation_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invitation_id, user_id)
);

-- 6) Storage packs
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
);
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
);
CREATE INDEX IF NOT EXISTS storage_entitlements_user_status_idx ON storage_entitlements(user_id, status, expires_at);

-- 7) Cloud works
CREATE TABLE IF NOT EXISTS cloud_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES workspaces(id) ON DELETE SET NULL,
  local_work_id text NOT NULL,
  title text NOT NULL,
  cover_key text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, local_work_id)
);
CREATE INDEX IF NOT EXISTS cloud_works_user_updated_idx ON cloud_works(user_id, updated_at DESC);

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
);
CREATE INDEX IF NOT EXISTS cloud_work_versions_work_idx ON cloud_work_versions(cloud_work_id, version_no);

CREATE TABLE IF NOT EXISTS cloud_storage_usage (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bytes_used bigint NOT NULL DEFAULT 0 CHECK (bytes_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8) One free grant per account
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_v1_free_grant_unique
  ON credit_transactions_v1(account_id, reference_type, reference_id)
  WHERE reference_type = 'free_plan';
