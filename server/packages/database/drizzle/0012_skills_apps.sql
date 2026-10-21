CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT '商品',
  description text NOT NULL DEFAULT '',
  cover text NOT NULL DEFAULT '',
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','rejected','disabled')),
  source_url text NOT NULL DEFAULT '',
  license text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skills_status_idx ON skills(status, visibility, created_at DESC);
CREATE TABLE IF NOT EXISTS skill_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version integer NOT NULL,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(skill_id, version)
);
CREATE TABLE IF NOT EXISTS apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT '商品',
  description text NOT NULL DEFAULT '',
  cover text NOT NULL DEFAULT '',
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_hint text NOT NULL DEFAULT '',
  credits bigint NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','disabled')),
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apps_status_idx ON apps(status, media_type, sort_order);

INSERT INTO skills(name,slug,category,description,manifest,visibility,status,featured,author,license)
VALUES
('商品摄影','product-photography','商品','为商品生成干净、真实、有质感的主图。','{"runtime":"prompt","promptTemplate":"为以下商品制作高级商业主图：{{product}}。保持商品外观、材质、颜色真实，画面干净，奶油色背景，柔和自然光，突出主体，真实摄影。","inputs":[{"key":"product","label":"商品描述","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',true,'WEAVIA','WEAVIA'),
('场景营销','scene-marketing','商品','把商品放进真实使用场景。','{"runtime":"prompt","promptTemplate":"为以下商品制作真实自然的使用场景图：{{product}}。场景符合商品用途，光线自然，构图高级，保留商品外观和关键文字真实。","inputs":[{"key":"product","label":"商品与场景","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',true,'WEAVIA','WEAVIA'),
('美妆护肤','beauty-skincare','美妆','高级护肤与美妆静物摄影。','{"runtime":"prompt","promptTemplate":"无品牌高级美妆静物：{{product}}。奶油色背景，湿润反光，柔和晨光，极简构图，真实材质，商业摄影。","inputs":[{"key":"product","label":"产品描述","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('食品饮料','food-beverage','食品','暖调食品与饮料广告图。','{"runtime":"prompt","promptTemplate":"高级食品广告摄影：{{product}}。自然侧光，暖色调，真实食物质感，浅景深，奶油色台面，留白构图。","inputs":[{"key":"product","label":"食品描述","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('服饰模特','fashion-model','服饰','服饰商品与模特展示。','{"runtime":"prompt","promptTemplate":"服饰电商摄影：{{description}}。模特自然展示服装，保留服装颜色、版型和细节，简洁棚拍背景，高级时尚光。","inputs":[{"key":"description","label":"服装与模特描述","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('3C数码','tech-product','3C','数码产品的高级质感图。','{"runtime":"prompt","promptTemplate":"3C 产品商业摄影：{{product}}。深色极简背景，冷调轮廓光，金属与玻璃质感，真实产品细节，高级科技感。","inputs":[{"key":"product","label":"产品描述","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('家居氛围','home-lifestyle','家居','家居产品氛围场景。','{"runtime":"prompt","promptTemplate":"家居产品生活方式摄影：{{product}}。奶油色空间，柔和窗光，自然材质，真实生活场景，高级家居杂志构图。","inputs":[{"key":"product","label":"产品与空间","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('珠宝微距','jewelry-macro','珠宝','珠宝微距与高光质感。','{"runtime":"prompt","promptTemplate":"珠宝微距商业摄影：{{product}}。微距细节，金色高光，深色丝绒背景，真实宝石折射，高级珠宝广告。","inputs":[{"key":"product","label":"珠宝描述","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('节日营销','festival-campaign','营销','节日营销主视觉。','{"runtime":"prompt","promptTemplate":"节日营销主视觉：{{campaign}}。{{product}}。高级商业海报构图，节日氛围，留白区域适合后期文字，真实产品。","inputs":[{"key":"campaign","label":"节日/主题","type":"text","required":true},{"key":"product","label":"商品描述","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('详情页配图','detail-page','电商','电商详情页配图。','{"runtime":"prompt","promptTemplate":"电商详情页配图：{{product}}。表现{{sellingPoint}}，干净背景，信息清晰，适合详情页排版，真实商业摄影。","inputs":[{"key":"product","label":"商品","type":"text","required":true},{"key":"sellingPoint","label":"卖点","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('SKU变体','sku-variant','电商','同一商品的多规格视觉。','{"runtime":"prompt","promptTemplate":"为同一商品生成规格变体图：{{product}}。规格：{{variant}}。保持统一光线、背景和构图，真实商品细节。","inputs":[{"key":"product","label":"商品","type":"text","required":true},{"key":"variant","label":"规格","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA'),
('视频分镜','video-storyboard','视频','商品短视频分镜文本。','{"runtime":"prompt","promptTemplate":"为商品短视频生成分镜脚本：{{product}}。输出 5 个镜头，每个镜头包含画面、机位、时长和转场。","inputs":[{"key":"product","label":"商品与目标","type":"text","required":true}],"defaultModel":"qwen-image-2.0","capabilities":["text_to_image"]}'::jsonb,'public','published',false,'WEAVIA','WEAVIA')
ON CONFLICT(slug) DO NOTHING;

INSERT INTO apps(name,slug,category,description,media_type,manifest,input_schema,examples,model_hint,credits,status,featured,sort_order)
VALUES
('商品主图','app-product-hero','商品','一键生成干净高级的商品主图。','image','{"promptTemplate":"为以下商品制作高级商业主图：{{product}}。保持商品真实，奶油色背景，柔和自然光，突出主体，真实摄影。","inputs":[{"key":"product","type":"text","label":"商品描述","required":true}],"model":"qwen-image-2.0"}'::jsonb,'[{"key":"product","type":"text","label":"商品描述","required":true}]'::jsonb,'[]'::jsonb,'qwen-image-2.0',10,'published',true,10),
('场景营销图','app-scene','商品','把商品放进真实场景。','image','{"promptTemplate":"为以下商品制作自然使用场景图：{{product}}。场景符合用途，自然光，高级构图，保留商品外观。","inputs":[{"key":"product","type":"text","label":"商品与场景","required":true}],"model":"qwen-image-2.0"}'::jsonb,'[{"key":"product","type":"text","label":"商品与场景","required":true}]'::jsonb,'[]'::jsonb,'qwen-image-2.0',10,'published',true,20),
('美妆静物','app-beauty','美妆','护肤美妆高级静物。','image','{"promptTemplate":"无品牌高级美妆静物：{{product}}。奶油色背景，柔和晨光，真实材质，商业摄影。","inputs":[{"key":"product","type":"text","label":"产品描述","required":true}],"model":"qwen-image-2.0"}'::jsonb,'[{"key":"product","type":"text","label":"产品描述","required":true}]'::jsonb,'[]'::jsonb,'qwen-image-2.0',10,'published',false,30),
('食品暖光','app-food','食品','食品饮料暖调广告图。','image','{"promptTemplate":"高级食品广告摄影：{{product}}。自然侧光，暖色调，真实食物质感，浅景深，奶油色台面。","inputs":[{"key":"product","type":"text","label":"食品描述","required":true}],"model":"qwen-image-2.0"}'::jsonb,'[{"key":"product","type":"text","label":"食品描述","required":true}]'::jsonb,'[]'::jsonb,'qwen-image-2.0',10,'published',false,40),
('3C质感','app-tech','3C','数码产品高级质感。','image','{"promptTemplate":"3C 产品商业摄影：{{product}}。深色极简背景，冷调轮廓光，金属玻璃质感，真实细节。","inputs":[{"key":"product","type":"text","label":"产品描述","required":true}],"model":"qwen-image-2.0"}'::jsonb,'[{"key":"product","type":"text","label":"产品描述","required":true}]'::jsonb,'[]'::jsonb,'qwen-image-2.0',10,'published',false,50),
('家居氛围','app-home','家居','家居产品氛围图。','image','{"promptTemplate":"家居产品生活方式摄影：{{product}}。奶油色空间，柔和窗光，自然材质，高级家居杂志构图。","inputs":[{"key":"product","type":"text","label":"产品与空间","required":true}],"model":"qwen-image-2.0"}'::jsonb,'[{"key":"product","type":"text","label":"产品与空间","required":true}]'::jsonb,'[]'::jsonb,'qwen-image-2.0',10,'published',false,60),
('商品展示视频','app-product-video','视频','商品展示短视频（待视频能力接入）。','video','{"promptTemplate":"商品展示视频：{{product}}","inputs":[{"key":"product","type":"text","label":"商品描述","required":true}],"model":"wan2.7-t2v"}'::jsonb,'[{"key":"product","type":"text","label":"商品描述","required":true}]'::jsonb,'[]'::jsonb,'wan2.7-t2v',50,'draft',false,70),
('场景短视频','app-scene-video','视频','场景短视频（待视频能力接入）。','video','{"promptTemplate":"商品使用场景短视频：{{product}}","inputs":[{"key":"product","type":"text","label":"场景描述","required":true}],"model":"wan2.7-t2v"}'::jsonb,'[{"key":"product","type":"text","label":"场景描述","required":true}]'::jsonb,'[]'::jsonb,'wan2.7-t2v',50,'draft',false,80)
ON CONFLICT(slug) DO NOTHING;
