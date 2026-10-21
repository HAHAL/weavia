-- Encrypted provider keys managed from the admin console.
CREATE TABLE IF NOT EXISTS provider_credentials (
  provider_code text PRIMARY KEY CHECK (provider_code IN ('antdigital','dashscope')),
  encrypted_key bytea NOT NULL,
  key_last4 text NOT NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
