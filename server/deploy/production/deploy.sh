#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR="${PROJECT_DIR:-/opt/weavia}"
EXPECTED_VERSION="${EXPECTED_VERSION:-}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

cd "${PROJECT_DIR}"
[[ -f VERSION ]] || { echo "Missing ${PROJECT_DIR}/VERSION" >&2; exit 1; }
VERSION="$(tr -d '[:space:]' < VERSION)"
[[ -n "${VERSION}" ]] || { echo "VERSION is empty" >&2; exit 1; }
if [[ -n "${EXPECTED_VERSION}" && "${VERSION}" != "${EXPECTED_VERSION}" ]]; then
  echo "Version mismatch: expected ${EXPECTED_VERSION}, got ${VERSION}" >&2
  exit 1
fi

for name in DATABASE_URL WEAVIA_WEB_ORIGIN STORAGE_SIGNING_KEY AUTH_VERIFICATION_SECRET SMTP_HOST SMTP_USER SMTP_PASSWORD SMTP_FROM BACKUP_DIR; do
  [[ -n "${!name:-}" ]] || { echo "Missing required production variable: $name" >&2; exit 1; }
done
[[ "$DATABASE_URL" == *"sslmode=require"* || "$DATABASE_URL" == *"sslmode=verify-ca"* || "$DATABASE_URL" == *"sslmode=verify-full"* ]] || { echo "DATABASE_URL must require TLS" >&2; exit 1; }
[[ "$WEAVIA_WEB_ORIGIN" == https://* ]] || { echo "WEAVIA_WEB_ORIGIN must use HTTPS" >&2; exit 1; }
[[ ${#STORAGE_SIGNING_KEY} -ge 32 ]] || { echo "STORAGE_SIGNING_KEY must be at least 32 characters" >&2; exit 1; }
[[ ${ENABLE_REAL_AI:-false} == false ]] || { echo "Real AI requires a separate paid-provider release gate" >&2; exit 1; }

docker info >/dev/null
docker compose version >/dev/null
compose=(docker compose -f docker-compose.production.yml)
"${compose[@]}" config --quiet >/dev/null

echo "Building WEAVIA ${VERSION} production images"
"${compose[@]}" build

echo "Backing up and migrating the production database"
bash scripts/production-migrate.sh

echo "Starting production services"
"${compose[@]}" up -d --remove-orphans

deadline=$((SECONDS + HEALTH_TIMEOUT))
until bash deploy/production/smoke.sh >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    echo "Production smoke checks timed out" >&2
    bash deploy/production/smoke.sh || true
    "${compose[@]}" ps
    exit 1
  fi
  sleep 3
done

worker_id="$("${compose[@]}" ps -q worker)"
[[ -n "$worker_id" && "$(docker inspect -f '{{.State.Running}}' "$worker_id")" == true ]] || {
  echo "Worker is not running" >&2
  "${compose[@]}" ps
  exit 1
}

echo "WEAVIA ${VERSION} passed local production smoke checks"
"${compose[@]}" ps
