#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
create_admin="$script_dir/create-admin"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

fake_psql="$tmp_dir/psql"
cat > "$fake_psql" <<'FAKE_PSQL'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${*}" == *"SELECT id::text FROM users"* ]]; then
  [[ "${FAKE_PSQL_MODE:-}" == "present" ]] && printf '%s\n' '00000000-0000-4000-8000-000000000001'
elif [[ "${*}" == *"SELECT id::text FROM roles"* ]]; then
  printf '%s\n' '00000000-0000-4000-8000-000000000002'
elif [[ "${*}" == *"INSERT INTO user_roles"* ]]; then
  printf '%s\n' insert >> "${FAKE_PSQL_LOG:?}"
fi
FAKE_PSQL
chmod +x "$fake_psql"

if DATABASE_URL=test PSQL_BIN="$fake_psql" "$create_admin" >/dev/null 2>&1; then
  echo "missing email should fail" >&2
  exit 1
fi

if DATABASE_URL=test PSQL_BIN="$fake_psql" "$create_admin" missing-at-symbol >/dev/null 2>&1; then
  echo "invalid email should fail" >&2
  exit 1
fi

if DATABASE_URL=test PSQL_BIN="$fake_psql" FAKE_PSQL_MODE=missing "$create_admin" admin@example.com >/dev/null 2>&1; then
  echo "missing user should fail" >&2
  exit 1
fi

log_file="$tmp_dir/psql.log"
: > "$log_file"
DATABASE_URL=test PSQL_BIN="$fake_psql" FAKE_PSQL_MODE=present FAKE_PSQL_LOG="$log_file" \
  "$create_admin" ADMIN@EXAMPLE.COM >/dev/null

grep -qx insert "$log_file"
if grep -Eiq 'password|CREATE USER|INSERT INTO users|INSERT INTO accounts' "$create_admin"; then
  echo "admin initializer must not create credentials or users" >&2
  exit 1
fi

echo "create-admin tests passed"
