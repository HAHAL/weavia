-- 模型按「输入模态 → 输出模态」区分：文本 text、图像 image、视频 video、音频 audio（音乐/音效）、语音 speech（人声）。
-- modality 仍保存主输出模态，兼容现有客户端；输入/输出列表由用途推导，后台可见可筛选。
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS input_modalities jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE logical_models ADD COLUMN IF NOT EXISTS output_modalities jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE channel_models DROP CONSTRAINT IF EXISTS channel_models_modality_check;--> statement-breakpoint
ALTER TABLE channel_models ADD CONSTRAINT channel_models_modality_check CHECK (modality IN ('image','video','audio','speech','text'));--> statement-breakpoint
UPDATE logical_models SET
  input_modalities = (SELECT coalesce(jsonb_agg(DISTINCT m), '[]'::jsonb) FROM (
    SELECT 'text' AS m
    UNION SELECT 'image' WHERE capabilities ?| array['image_to_image','image_edit','image_to_video','reference_to_video','vision']
    UNION SELECT 'video' WHERE capabilities ?| array['video_edit']
  ) s),
  output_modalities = CASE WHEN modality IN ('image','video','audio','speech','text') THEN jsonb_build_array(modality) ELSE '["image"]'::jsonb END
WHERE input_modalities = '[]'::jsonb;
