-- WEAVIA V1: admin-managed showcase library.
CREATE TABLE IF NOT EXISTS showcase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'image' CHECK (kind IN ('image','work')),
  title text NOT NULL,
  tag text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  image_key text NOT NULL,
  image_mime text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS showcase_items_public_idx ON showcase_items(status, kind, sort_order, created_at DESC);--> statement-breakpoint
INSERT INTO permissions(code,description) VALUES ('showcase.write','Manage showcase images and works') ON CONFLICT(code) DO NOTHING;--> statement-breakpoint
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE p.code='showcase.write' AND r.code IN ('super_admin','operator')
ON CONFLICT DO NOTHING;--> statement-breakpoint
