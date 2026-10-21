CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."credit_reservation_status" AS ENUM('reserved', 'confirmed', 'released');--> statement-breakpoint
CREATE TYPE "public"."commercial_credit_transaction_type" AS ENUM('topup', 'consume', 'refund', 'admin_adjustment', 'reserve', 'release');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint

ALTER TABLE "accounts" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "access_token_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "refresh_token_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "refresh_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "token_hash" DROP NOT NULL;--> statement-breakpoint

CREATE TABLE "auth_requests" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "state_hash" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "authorized_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "auth_codes" (
  "id" uuid PRIMARY KEY,
  "auth_request_id" uuid NOT NULL REFERENCES "auth_requests"("id") ON DELETE cascade,
  "code_hash" text NOT NULL,
  "used_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "auth_codes_hash_unique" ON "auth_codes" ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_access_hash_unique" ON "sessions" ("access_token_hash") WHERE "access_token_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_hash_unique" ON "sessions" ("refresh_token_hash") WHERE "refresh_token_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade;--> statement-breakpoint

CREATE TABLE "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id"),
  "status" "subscription_status" NOT NULL,
  "current_period_start" timestamp with time zone NOT NULL,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "subscriptions_user_status_idx" ON "subscriptions" ("user_id", "status");--> statement-breakpoint
CREATE TABLE "entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("plan_id", "key")
);--> statement-breakpoint

INSERT INTO "plans" ("id", "code", "name", "billing_cycle", "price_minor", "included_credits", "max_devices", "max_concurrency", "entitlements") VALUES
('10000000-0000-4000-8000-000000000001', 'free', 'Free', 'month', 0, 50, 1, 1, '{"generation.monthly":50,"workspace.max":1,"member.max":1}'),
('10000000-0000-4000-8000-000000000002', 'pro', 'Pro', 'month', 9900, 1000, 3, 2, '{"generation.monthly":1000,"workspace.max":3,"member.max":3}'),
('10000000-0000-4000-8000-000000000003', 'studio', 'Studio', 'month', 29900, 5000, 10, 5, '{"generation.monthly":5000,"workspace.max":10,"member.max":10}'),
('10000000-0000-4000-8000-000000000004', 'agency', 'Agency', 'month', 99900, 20000, 50, 20, '{"generation.monthly":20000,"workspace.max":50,"member.max":50}')
ON CONFLICT ("code") DO UPDATE SET "name"=excluded."name", "price_minor"=excluded."price_minor", "included_credits"=excluded."included_credits", "max_devices"=excluded."max_devices", "max_concurrency"=excluded."max_concurrency", "entitlements"=excluded."entitlements", "updated_at"=now();--> statement-breakpoint

INSERT INTO "entitlements" ("plan_id", "key", "value")
SELECT p.id, e.key, e.value
FROM "plans" p CROSS JOIN LATERAL jsonb_each(p.entitlements) e
WHERE p.code IN ('free','pro','studio','agency')
ON CONFLICT ("plan_id", "key") DO UPDATE SET "value"=excluded."value", "updated_at"=now();--> statement-breakpoint

CREATE TABLE "credit_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "currency" text DEFAULT 'credits' NOT NULL,
  "available_balance" bigint DEFAULT 0 NOT NULL CHECK ("available_balance" >= 0),
  "reserved_balance" bigint DEFAULT 0 NOT NULL CHECK ("reserved_balance" >= 0),
  "version" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("user_id", "currency")
);--> statement-breakpoint
CREATE TABLE "credit_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "credit_accounts"("id") ON DELETE cascade,
  "amount" bigint NOT NULL CHECK ("amount" > 0),
  "status" "credit_reservation_status" DEFAULT 'reserved' NOT NULL,
  "reference_type" text NOT NULL,
  "reference_id" text NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "confirmed_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "credit_reservations_account_status_idx" ON "credit_reservations" ("account_id", "status");--> statement-breakpoint
CREATE TABLE "credit_transactions_v1" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "credit_accounts"("id") ON DELETE cascade,
  "reservation_id" uuid REFERENCES "credit_reservations"("id"),
  "type" "commercial_credit_transaction_type" NOT NULL,
  "available_delta" bigint NOT NULL,
  "reserved_delta" bigint NOT NULL,
  "balance_after" bigint NOT NULL,
  "reserved_after" bigint NOT NULL,
  "reference_type" text NOT NULL,
  "reference_id" text NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "actor_user_id" uuid REFERENCES "users"("id"),
  "metadata" jsonb DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "credit_transactions_v1_account_created_idx" ON "credit_transactions_v1" ("account_id", "created_at" DESC);--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id" uuid REFERENCES "users"("id"),
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "metadata" jsonb DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" ("resource_type", "resource_id", "created_at" DESC);--> statement-breakpoint

CREATE TABLE "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "workspace_members" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" "workspace_role" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("workspace_id", "user_id")
);--> statement-breakpoint
CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price_minor" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'CNY';--> statement-breakpoint
CREATE INDEX "products_project_idx" ON "products" ("project_id");--> statement-breakpoint
CREATE TABLE "skus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "attributes" jsonb DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("product_id", "code")
);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "product_id" uuid REFERENCES "products"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "sku_id" uuid REFERENCES "skus"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "kind" text DEFAULT 'source' NOT NULL;--> statement-breakpoint
CREATE INDEX "assets_sku_idx" ON "assets" ("sku_id", "created_at" DESC);--> statement-breakpoint

ALTER TABLE "tasks" ADD COLUMN "workspace_id" uuid REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "product_id" uuid REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sku_id" uuid REFERENCES "skus"("id");--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "credit_reservation_id" uuid REFERENCES "credit_reservations"("id");--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "cost" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint

INSERT INTO "subscriptions" ("user_id", "plan_id", "status", "current_period_start")
SELECT u.id, p.id, 'active', now() FROM "users" u CROSS JOIN "plans" p
WHERE p.code='free' AND NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s.user_id=u.id AND s.status IN ('trialing','active'));--> statement-breakpoint
INSERT INTO "credit_accounts" ("user_id", "available_balance")
SELECT id, 50 FROM "users" ON CONFLICT ("user_id", "currency") DO NOTHING;
