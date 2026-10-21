INSERT INTO ai_providers(code,name,type,base_url,enabled,configured)
VALUES ('computrix','Computrix MaaS','openai-compatible','https://maas-api.computrix.ai/v1',true,true)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,base_url=EXCLUDED.base_url,enabled=true,configured=true;--> statement-breakpoint
INSERT INTO provider_channels(provider_code,name,base_url,priority,weight,enabled)
SELECT 'computrix','Computrix MaaS','https://maas-api.computrix.ai/v1',120,1,true
WHERE NOT EXISTS (SELECT 1 FROM provider_channels WHERE provider_code='computrix' AND name='Computrix MaaS');--> statement-breakpoint
ALTER TABLE provider_credentials DROP CONSTRAINT IF EXISTS provider_credentials_provider_code_check;--> statement-breakpoint
ALTER TABLE provider_credentials ADD CONSTRAINT provider_credentials_provider_code_check CHECK (provider_code = ANY (ARRAY['antdigital','dashscope','computrix']));--> statement-breakpoint
