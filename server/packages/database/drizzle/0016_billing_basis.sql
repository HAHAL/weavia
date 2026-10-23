-- 结算口径：delivered=按上游实际交付计费；submitted=提交即计费（少返不退）。
ALTER TABLE channel_models ADD COLUMN IF NOT EXISTS billing_basis text NOT NULL DEFAULT 'delivered';--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channel_models_billing_basis_check'
  ) THEN
    ALTER TABLE channel_models ADD CONSTRAINT channel_models_billing_basis_check CHECK (billing_basis IN ('delivered','submitted'));
  END IF;
END $$;--> statement-breakpoint

-- 视频单条成本高，供应商多在提交后即计费，默认按提交数量结算。
UPDATE channel_models SET billing_basis = 'submitted' WHERE modality = 'video';--> statement-breakpoint
