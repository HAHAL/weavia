-- 渠道分组：默认组 + 优质组；账户可绑定分组，优先命中组内渠道。
CREATE TABLE IF NOT EXISTS route_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS channel_group_members (
  group_id uuid NOT NULL REFERENCES route_groups(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES provider_channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, channel_id)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS account_route_groups (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES route_groups(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);--> statement-breakpoint

INSERT INTO route_groups(code, name, description, is_default)
VALUES ('default', '默认组', '未绑定其他分组的账户走这里', true)
ON CONFLICT (code) DO NOTHING;--> statement-breakpoint

INSERT INTO channel_group_members(group_id, channel_id)
SELECT g.id, c.id FROM route_groups g CROSS JOIN provider_channels c
WHERE g.code = 'default'
ON CONFLICT DO NOTHING;--> statement-breakpoint
