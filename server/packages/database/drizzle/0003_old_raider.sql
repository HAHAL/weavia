CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"scene" text NOT NULL,
	"style" text NOT NULL,
	"prompt" text NOT NULL,
	"negative_prompt" text DEFAULT '' NOT NULL,
	"supported_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates" USING btree ("category");