#!/usr/bin/env bash
set -Eeuo pipefail

MIRROR_URL="${DOCKER_MIRROR:-https://docker.m.daocloud.io}"
failures=0

report() { printf '%-18s %s\n' "$1" "$2"; }
check() {
  if "$@" >/dev/null 2>&1; then return 0; fi
  failures=$((failures + 1))
  return 1
}

echo "WEAVIA server check"
report "CPU" "$(nproc) cores"
report "Memory" "$(free -h | awk '/^Mem:/ {print $3 " used / " $2}')"
report "Disk /" "$(df -h / | awk 'NR==2 {print $3 " used / " $2 " (" $5 ")"}')"

if check docker info; then report "Docker" "ok"; else report "Docker" "failed"; fi
if check docker compose version; then report "Compose" "ok"; else report "Compose" "failed"; fi
if curl -fsS --max-time 10 "${MIRROR_URL}/v2/" >/dev/null 2>&1 || [[ "$?" -eq 22 ]]; then
  report "Docker mirror" "reachable: ${MIRROR_URL}"
else
  failures=$((failures + 1))
  report "Docker mirror" "unreachable: ${MIRROR_URL}"
fi
if check getent hosts registry-1.docker.io; then report "DNS" "ok"; else report "DNS" "failed"; fi

if [[ "${failures}" -gt 0 ]]; then
  echo "检查失败项: ${failures}" >&2
  exit 1
fi
echo "服务器检查通过。"
