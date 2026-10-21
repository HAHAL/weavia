#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
if [[ -z "${BACKUP_DIR:-}" || ! -d "${BACKUP_DIR}" ]]; then
  echo "BACKUP_DIR must point to an existing writable backup directory" >&2
  exit 1
fi
if [[ "${DATABASE_URL}" == *"weavia:weavia@"* ]] ||
  [[ "${DATABASE_URL}" != *"sslmode=require"* && "${DATABASE_URL}" != *"sslmode=verify-ca"* && "${DATABASE_URL}" != *"sslmode=verify-full"* ]]; then
  echo "Refusing development database credentials or a database URL without required TLS" >&2
  exit 1
fi
for command_name in pg_dump psql pnpm go; do
  command -v "$command_name" >/dev/null || { echo "$command_name is required" >&2; exit 1; }
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_file="${BACKUP_DIR%/}/weavia-$(date -u +%Y%m%dT%H%M%SZ).dump"
if [[ -e "$backup_file" ]]; then echo "Backup already exists: $backup_file" >&2; exit 1; fi

echo "Backing up database to $backup_file"
pg_dump --format=custom --no-owner --file="$backup_file" "$DATABASE_URL"
test -s "$backup_file" || { echo "Backup is empty" >&2; exit 1; }

cd "$repo_root"
echo "Applying application migrations"
pnpm db:migrate
echo "Applying River migrations"
(cd services/backend && go run ./cmd/migrate)

echo "Verifying schema and seeds"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 1 / (COUNT(*) = 1)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_audit_logs';
SELECT 1 / (COUNT(*) = 1)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='credit_reservations';
SELECT 1 / (COUNT(*) = 1)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='river_job';
SELECT 1 / (COUNT(*) = 1)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='registration_requests';
SELECT 1 / (COUNT(*) = 1)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='email_verifications';
SELECT 1 / (COUNT(*) = 1)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='user_deletion_requests';
SELECT 1 / (COUNT(*) = 4)::int FROM plans WHERE code IN ('free','pro','studio','agency');
SELECT 1 / (COUNT(*) = 3)::int FROM roles WHERE code IN ('super_admin','operator','finance');
SELECT 1 / (COUNT(*) = 3)::int FROM ai_models WHERE model_name IN ('qwen-image-max','qwen-image-2.0','qwen-image-edit-plus') AND credit_cost > 0;
SQL
echo "Migration complete. Backup: $backup_file"
