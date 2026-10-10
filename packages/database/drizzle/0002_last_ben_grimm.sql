CREATE TYPE "public"."asset_role" AS ENUM('INPUT', 'REFERENCE_IMAGE', 'GENERATED_RESULT');--> statement-breakpoint
CREATE TYPE "public"."asset_upload_status" AS ENUM('LOCAL', 'PENDING', 'UPLOADED', 'FAILED', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."task_type" ADD VALUE 'product_image_generation' BEFORE 'image_generation';--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"asset_role" "asset_role" DEFAULT 'INPUT' NOT NULL,
	"upload_status" "asset_upload_status" DEFAULT 'LOCAL' NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"object_key" text,
	"remote_reference_id" text,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_project_idx" ON "assets" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "assets_project_role_idx" ON "assets" USING btree ("project_id","asset_role");