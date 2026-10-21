#!/usr/bin/env bash
set -Eeuo pipefail

MIRROR_URL="${DOCKER_MIRROR:-https://docker.m.daocloud.io}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 运行此脚本。" >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  echo "无法识别操作系统。" >&2
  exit 1
fi
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "需要 Ubuntu，当前为 ${PRETTY_NAME:-unknown}。" >&2
  exit 1
fi
case "${VERSION_ID:-}" in
  24.04|26.04) ;;
  *) echo "需要 Ubuntu 24.04 或 26.04，当前为 ${PRETTY_NAME:-unknown}。" >&2; exit 1 ;;
esac

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose-v2 python3

systemctl enable --now docker
install -d -m 0755 /etc/docker

python3 - "${MIRROR_URL}" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path("/etc/docker/daemon.json")
try:
    config = json.loads(path.read_text()) if path.exists() else {}
except json.JSONDecodeError as exc:
    raise SystemExit(f"/etc/docker/daemon.json 不是有效 JSON: {exc}")
config["registry-mirrors"] = [sys.argv[1].rstrip("/")]
path.write_text(json.dumps(config, indent=2) + "\n")
PY

systemctl daemon-reload
systemctl restart docker

docker version
docker compose version
docker info --format '{{json .RegistryConfig.IndexConfigs}}'
echo "Docker 初始化完成，镜像源: ${MIRROR_URL}"
