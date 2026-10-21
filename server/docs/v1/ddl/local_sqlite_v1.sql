-- WEAVIA Desktop local SQLite v1 draft
-- Legacy: client_state(id,data,updated_at) JSON snapshot stays read-only during migration.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('schema_version', '1');

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('image','video')),
  product_id TEXT,
  cover_path TEXT,
  server_work_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS works_updated_idx ON works(updated_at DESC);

CREATE TABLE IF NOT EXISTS work_versions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  prompt TEXT NOT NULL DEFAULT '',
  local_path TEXT NOT NULL,
  thumb_path TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  source_task_id TEXT,
  cloud_version_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local','uploading','uploaded','failed')),
  created_at TEXT NOT NULL,
  UNIQUE(work_id, version_no)
);

CREATE TABLE IF NOT EXISTS conversations_local (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages_local (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations_local(id) ON DELETE CASCADE,
  server_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  params_json TEXT NOT NULL DEFAULT '{}',
  attachments_json TEXT NOT NULL DEFAULT '[]',
  task_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_local_conversation_idx ON messages_local(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS assets_local (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  mime TEXT NOT NULL,
  local_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_next_attempt_idx ON outbox(next_attempt_at);
