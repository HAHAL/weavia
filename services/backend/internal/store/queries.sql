-- name: EnsureDemoUser :exec
INSERT INTO users (id,email,name,status,created_at,updated_at)
VALUES ('00000000-0000-4000-8000-000000000001','demo@weavia.local','WEAVIA Demo','active',now(),now())
ON CONFLICT (id) DO NOTHING;

-- name: CreateTask :one
INSERT INTO tasks (id,user_id,type,status,idempotency_key,input,output,error,pricing_snapshot,reserved_credits,consumed_credits,created_at,updated_at)
VALUES ($1,$2,$3::task_type,'queued',$4,$5,NULL,NULL,'{}'::jsonb,0,0,$6,$6)
ON CONFLICT (user_id,idempotency_key) DO UPDATE SET updated_at=tasks.updated_at
RETURNING id::text AS id,user_id::text AS user_id,type::text AS type,status::text AS status,idempotency_key,input,output,error,created_at,updated_at;

-- name: GetTask :one
SELECT id::text AS id,user_id::text AS user_id,type::text AS type,status::text AS status,idempotency_key,input,output,error,created_at,updated_at
FROM tasks WHERE id=$1;

-- name: ListTasks :many
SELECT id::text AS id,user_id::text AS user_id,type::text AS type,status::text AS status,idempotency_key,input,output,error,created_at,updated_at
FROM tasks WHERE user_id=$1 ORDER BY created_at DESC;

-- name: UpdateTask :exec
UPDATE tasks SET status=$2::task_status, output=$3, error=$4, updated_at=$5 WHERE id=$1;
