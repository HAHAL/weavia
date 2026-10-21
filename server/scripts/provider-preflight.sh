#!/usr/bin/env bash
set -euo pipefail

# Read-only gate before a separately approved, billable provider smoke test.
fail() { echo "Provider preflight failed: $*" >&2; exit 1; }
require() { [[ -n "${!1:-}" ]] || fail "$1 is required"; }

for name in DATABASE_URL ASSET_STORAGE_DIR STORAGE_SIGNING_KEY PROVIDER_TEST_MODEL PROVIDER_TEST_APPROVAL_ID PROVIDER_TEST_MAX_CALLS PROVIDER_TEST_BUDGET_CNY; do
  require "$name"
done
[[ "${APP_ENV:-}" == production ]] || fail 'APP_ENV must be production'
[[ "${DEMO_MODE:-false}" == false ]] || fail 'DEMO_MODE must be false'
[[ "${ENABLE_REAL_AI:-false}" == false ]] || fail 'ENABLE_REAL_AI must remain false during preflight'
[[ "$DATABASE_URL" == *sslmode=require* || "$DATABASE_URL" == *sslmode=verify-ca* || "$DATABASE_URL" == *sslmode=verify-full* ]] || fail 'DATABASE_URL must explicitly require TLS'
[[ ${#STORAGE_SIGNING_KEY} -ge 32 && "$STORAGE_SIGNING_KEY" != weavia-development-only && "$STORAGE_SIGNING_KEY" != change-me* ]] || fail 'STORAGE_SIGNING_KEY must be a strong non-default value'
[[ "$PROVIDER_TEST_MAX_CALLS" =~ ^[1-9][0-9]*$ ]] || fail 'PROVIDER_TEST_MAX_CALLS must be a positive integer'
[[ "$PROVIDER_TEST_BUDGET_CNY" =~ ^[0-9]+([.][0-9]{1,2})?$ ]] && [[ "$PROVIDER_TEST_BUDGET_CNY" != 0 && "$PROVIDER_TEST_BUDGET_CNY" != 0.00 ]] || fail 'PROVIDER_TEST_BUDGET_CNY must be positive'
[[ -d "$ASSET_STORAGE_DIR" && -w "$ASSET_STORAGE_DIR" ]] || fail 'ASSET_STORAGE_DIR must exist and be writable'
command -v psql >/dev/null || fail 'psql is required'

provider="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -v model="$PROVIDER_TEST_MODEL" <<'SQL'
SELECT p.code
FROM ai_models m JOIN ai_providers p ON p.id=m.provider_id
WHERE m.model_name=:'model' AND m.enabled AND p.enabled AND m.credit_cost > 0;
SQL
)" || fail 'database model lookup failed'
[[ -n "$provider" && "$provider" != *$'\n'* ]] || fail 'exactly one enabled priced model is required'

case "$provider" in
  antdigital)
    require ANTDIGITAL_API_KEY
    base_url="${ANTDIGITAL_BASE_URL:-https://maas-api.antdigital.com/v1}"
    ;;
  dashscope)
    require DASHSCOPE_API_KEY
    base_url="${DASHSCOPE_BASE_URL:-https://dashscope.aliyuncs.com/api/v1}"
    ;;
  *) fail "unsupported configured provider: $provider" ;;
esac
[[ "$base_url" == https://* ]] || fail 'provider base URL must use HTTPS'

echo "Preflight passed for model $PROVIDER_TEST_MODEL ($provider). Approval: $PROVIDER_TEST_APPROVAL_ID; maximum calls: $PROVIDER_TEST_MAX_CALLS; budget: CNY $PROVIDER_TEST_BUDGET_CNY. No provider call was made."
