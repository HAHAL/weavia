CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_name text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS task_events (
  id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stage text NOT NULL,
  state text NOT NULL,
  code text NOT NULL DEFAULT '',
  duration_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS task_events_task_created_idx ON task_events(task_id, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS task_events_created_idx ON task_events(created_at);--> statement-breakpoint

INSERT INTO permissions(code,description) VALUES ('ops.read','Read operational status and safe logs')
ON CONFLICT(code) DO NOTHING;--> statement-breakpoint
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('super_admin','operator') AND p.code='ops.read'
ON CONFLICT DO NOTHING;--> statement-breakpoint
