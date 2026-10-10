-- sqlc analysis mirror. Runtime schema remains packages/database/drizzle/*.sql.
CREATE TYPE task_status AS ENUM ('pending','queued','uploading','running','downloading','reconciling','success','failed','cancelled');
CREATE TYPE task_type AS ENUM ('ai_model','ai_commercial','product_image_generation','image_generation','image_edit','image_to_video');
CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text, avatar_url text,
  status text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE tasks (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), type task_type NOT NULL,
  status task_status NOT NULL, idempotency_key text NOT NULL, input jsonb NOT NULL,
  output jsonb, error jsonb, pricing_snapshot jsonb NOT NULL, reserved_credits bigint NOT NULL,
  consumed_credits bigint NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  UNIQUE(user_id,idempotency_key)
);
