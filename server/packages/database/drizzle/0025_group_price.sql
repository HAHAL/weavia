-- 分组价格倍率：最终售价 = 逻辑模型 Credits × 分组倍率。
ALTER TABLE route_groups ADD COLUMN IF NOT EXISTS price_multiplier numeric(6,3) NOT NULL DEFAULT 1.000;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'route_groups_price_multiplier_check') THEN
    ALTER TABLE route_groups ADD CONSTRAINT route_groups_price_multiplier_check CHECK (price_multiplier > 0 AND price_multiplier <= 10);
  END IF;
END $$;--> statement-breakpoint
