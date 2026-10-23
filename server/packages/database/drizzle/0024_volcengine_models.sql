-- 火山方舟视频模型目录：先接入 Seedance 2.0 Fast / 2.5，成本待合同核实。
INSERT INTO logical_models(key, display_name, type, icon, modality, capabilities, credits_cost, params, enabled, sort_order)
VALUES
  ('doubao-seedance-2-0-fast-260128', 'Seedance 2.0 Fast', 'video', 'video', 'video', '["text_to_video"]'::jsonb, 50,
   '{"ratios":["16:9","9:16","1:1"],"durations":[5,10],"resolutions":["720p"]}'::jsonb, true, 120),
  ('doubao-seedance-2-5-260628', 'Seedance 2.5', 'video', 'video', 'video', '["text_to_video"]'::jsonb, 50,
   '{"ratios":["16:9","9:16","1:1"],"durations":[5,10],"resolutions":["720p"]}'::jsonb, true, 121)
ON CONFLICT (key) DO UPDATE SET display_name=EXCLUDED.display_name, modality=EXCLUDED.modality,
  capabilities=EXCLUDED.capabilities, params=EXCLUDED.params, enabled=EXCLUDED.enabled;--> statement-breakpoint

INSERT INTO channel_models(channel_id, provider_model_id, display_name, modality, capabilities, params, enabled)
SELECT c.id, m.provider_model_id, m.display_name, 'video', '["text_to_video"]'::jsonb,
       '{"ratios":["16:9","9:16","1:1"],"durations":[5,10],"resolutions":["720p"]}'::jsonb, true
FROM provider_channels c
JOIN (VALUES
  ('doubao-seedance-2-0-fast-260128', 'Seedance 2.0 Fast'),
  ('doubao-seedance-2-5-260628', 'Seedance 2.5')
) AS m(provider_model_id, display_name) ON true
WHERE c.provider_code = 'volcengine'
ON CONFLICT (channel_id, provider_model_id) DO NOTHING;--> statement-breakpoint

INSERT INTO logical_model_abilities(logical_model_id, channel_model_id, priority, weight, enabled)
SELECT lm.id, cm.id, 100, 1, true
FROM logical_models lm
JOIN channel_models cm ON cm.provider_model_id = lm.key
JOIN provider_channels c ON c.id = cm.channel_id AND c.provider_code = 'volcengine'
WHERE lm.key IN ('doubao-seedance-2-0-fast-260128', 'doubao-seedance-2-5-260628')
ON CONFLICT (logical_model_id, channel_model_id) DO NOTHING;--> statement-breakpoint
