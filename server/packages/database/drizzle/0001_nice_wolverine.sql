CREATE TABLE "logical_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"display_name" text NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logical_model_id" uuid NOT NULL,
	"provider_model_id" uuid NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"modality" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"input_cost" numeric(18, 6),
	"output_cost" numeric(18, 6),
	"currency" text,
	"pricing_unit" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"provider_model_id" uuid NOT NULL,
	"logical_model" text NOT NULL,
	"workflow" text NOT NULL,
	"status" text NOT NULL,
	"attempt" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"provider_request_id" text,
	"estimated_cost" numeric(18, 6),
	"actual_cost" numeric(18, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "type" text DEFAULT 'openai-compatible' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "base_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "configured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "model_bindings" ADD CONSTRAINT "model_bindings_logical_model_id_logical_models_id_fk" FOREIGN KEY ("logical_model_id") REFERENCES "public"."logical_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_bindings" ADD CONSTRAINT "model_bindings_provider_model_id_provider_models_id_fk" FOREIGN KEY ("provider_model_id") REFERENCES "public"."provider_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_models" ADD CONSTRAINT "provider_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_provider_model_id_provider_models_id_fk" FOREIGN KEY ("provider_model_id") REFERENCES "public"."provider_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "logical_models_key_unique" ON "logical_models" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "model_bindings_logical_provider_unique" ON "model_bindings" USING btree ("logical_model_id","provider_model_id");--> statement-breakpoint
CREATE INDEX "model_bindings_priority_idx" ON "model_bindings" USING btree ("logical_model_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_models_provider_model_unique" ON "provider_models" USING btree ("provider_id","model_id");--> statement-breakpoint
CREATE INDEX "provider_usage_provider_created_idx" ON "provider_usage" USING btree ("provider_id","created_at");--> statement-breakpoint
CREATE INDEX "provider_usage_task_idx" ON "provider_usage" USING btree ("task_id");