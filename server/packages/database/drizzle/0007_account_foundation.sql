-- Sprint 3.1 is additive and safe to execute again. Physical user deletion is blocked
-- until the commercial retention model has a separately reviewed migration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique ON users (lower(btrim(email)));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS registration_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, password_hash text NOT NULL,
 name text NOT NULL DEFAULT '', expires_at timestamptz NOT NULL, completed_at timestamptz,
 user_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT registration_requests_normalized_email CHECK (email = lower(btrim(email)))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS registration_requests_pending_email_unique ON registration_requests(email) WHERE completed_at IS NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS email_verifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id),
 registration_request_id uuid REFERENCES registration_requests(id), email text NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('registration','password_reset')),
 code_hash text NOT NULL, token_hash text NOT NULL, expires_at timestamptz NOT NULL,
 used_at timestamptz, send_count integer NOT NULL DEFAULT 1, next_send_at timestamptz NOT NULL,
 attempt_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT email_verifications_subject CHECK ((purpose='registration' AND registration_request_id IS NOT NULL) OR (purpose='password_reset' AND user_id IS NOT NULL))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_verifications_lookup_idx ON email_verifications(email,purpose,created_at DESC);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS login_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), device_id uuid REFERENCES devices(id),
 platform text, ip_address inet, user_agent text, login_time timestamptz NOT NULL DEFAULT now(),
 success boolean NOT NULL, failure_reason text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS login_events_user_time_idx ON login_events(user_id,login_time DESC);--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_family_id uuid;--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at timestamptz;--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_reason text;--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS replaced_by_session_id uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sessions_family_idx ON sessions(token_family_id);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS user_deletion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'deletion_requested' CHECK(status IN ('deletion_requested','approved','rejected')),
 reason text, requested_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 reviewed_by uuid REFERENCES users(id), review_reason text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS user_deletion_requests_pending_unique ON user_deletion_requests(user_id) WHERE status='deletion_requested';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS data_deletion_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE REFERENCES user_deletion_requests(id),
 user_id uuid NOT NULL REFERENCES users(id), approved_by uuid NOT NULL REFERENCES users(id),
 approved_at timestamptz NOT NULL, idempotency_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
 checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION weavia_guard_deletion_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM user_deletion_requests r WHERE r.id=NEW.request_id AND r.user_id=NEW.user_id AND r.status='approved' AND r.reviewed_by=NEW.approved_by AND r.reviewed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'deletion job requires an approved request';
 END IF;
 RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS weavia_guard_deletion_job_trigger ON data_deletion_jobs;--> statement-breakpoint
CREATE TRIGGER weavia_guard_deletion_job_trigger BEFORE INSERT OR UPDATE ON data_deletion_jobs FOR EACH ROW EXECUTE FUNCTION weavia_guard_deletion_job();--> statement-breakpoint
CREATE OR REPLACE FUNCTION weavia_protect_user_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'physical user deletion is disabled; use reviewed deletion jobs'; END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS weavia_protect_user_delete_trigger ON users;--> statement-breakpoint
CREATE TRIGGER weavia_protect_user_delete_trigger BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION weavia_protect_user_delete();--> statement-breakpoint
