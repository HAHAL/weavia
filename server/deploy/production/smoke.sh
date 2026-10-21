#!/usr/bin/env bash
set -Eeuo pipefail

api="${SMOKE_API_URL:-http://127.0.0.1:8080}"
web="${SMOKE_WEB_URL:-http://127.0.0.1:3000}"
admin="${SMOKE_ADMIN_URL:-http://127.0.0.1:3001}"

curl -fsS --max-time 5 "$api/api/health" | grep -q '"status":"ok"'
curl -fsS --max-time 5 "$api/api/readiness" | grep -q '"status":"ready"'
curl -fsS --max-time 5 "$api/api/plans" >/dev/null

unauthorized="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$api/api/admin/overview")"
[[ "$unauthorized" == 401 ]] || { echo "Anonymous admin API returned $unauthorized, expected 401" >&2; exit 1; }

curl -fsS --max-time 5 "$web/" >/dev/null
curl -fsS --max-time 5 "$web/signup" >/dev/null
curl -fsS --max-time 5 "$admin/login" >/dev/null

echo "API health, readiness, plans, anonymous authorization, Web and Admin pages passed"
