ALTER TABLE auth_requests ALTER COLUMN user_id DROP NOT NULL;--> statement-breakpoint

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);--> statement-breakpoint
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);--> statement-breakpoint
CREATE TABLE admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  ip inet,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX admin_audit_logs_created_idx ON admin_audit_logs (created_at DESC);--> statement-breakpoint

INSERT INTO roles(code,name) VALUES ('super_admin','Super Admin'),('operator','Operator'),('finance','Finance') ON CONFLICT(code) DO NOTHING;--> statement-breakpoint
INSERT INTO permissions(code,description) VALUES
 ('admin.read','Read administration data'),
 ('provider.write','Change provider settings'),
 ('credits.write','Adjust Credits'),
 ('users.write','Change user status'),
 ('plans.write','Change plans')
 ON CONFLICT(code) DO NOTHING;--> statement-breakpoint
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
 WHERE r.code='super_admin' OR (r.code='operator' AND p.code IN ('admin.read','provider.write','users.write')) OR (r.code='finance' AND p.code IN ('admin.read','credits.write','plans.write'))
 ON CONFLICT DO NOTHING;--> statement-breakpoint

ALTER TABLE ai_models ADD COLUMN model_name text;--> statement-breakpoint
ALTER TABLE ai_models ADD COLUMN provider text;--> statement-breakpoint
ALTER TABLE ai_models ADD COLUMN credit_cost bigint;--> statement-breakpoint
ALTER TABLE ai_models ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint
CREATE UNIQUE INDEX ai_models_model_name_unique ON ai_models(model_name) WHERE model_name IS NOT NULL;--> statement-breakpoint

INSERT INTO ai_providers(id,code,name,type,base_url,enabled,configured) VALUES
 ('00000000-0000-4000-8000-000000000101','antdigital','Ant Digital MaaS','openai-compatible','https://maas-api.antdigital.com/v1',true,false),
 ('00000000-0000-4000-8000-000000000105','dashscope','Alibaba Cloud Model Studio','dashscope-multimodal','https://dashscope.aliyuncs.com/api/v1',true,false)
 ON CONFLICT(code) DO NOTHING;--> statement-breakpoint
INSERT INTO ai_models(provider_id,external_id,display_name,capabilities,pricing,enabled,model_name,provider,credit_cost,metadata)
SELECT p.id, seed.model_name, seed.display_name, seed.capabilities::jsonb, '{}'::jsonb, true, seed.model_name, seed.provider, seed.credit_cost, seed.metadata::jsonb
FROM (VALUES
 ('qwen-image-max','Qwen Image Max','antdigital',30,'["text_to_image"]','{"estimatedSeconds":45}'),
 ('qwen-image-2.0','Qwen Image 2.0','antdigital',10,'["text_to_image","image_to_image"]','{"maxReferences":1,"estimatedSeconds":30}'),
 ('qwen-image-edit-plus','Qwen Image Edit Plus','dashscope',50,'["image_to_image","image_edit"]','{"maxReferences":3}')
) AS seed(model_name,display_name,provider,credit_cost,capabilities,metadata)
JOIN ai_providers p ON p.code=seed.provider
ON CONFLICT(provider_id,external_id) DO UPDATE SET model_name=excluded.model_name,provider=excluded.provider,credit_cost=excluded.credit_cost,metadata=excluded.metadata,enabled=excluded.enabled;--> statement-breakpoint
