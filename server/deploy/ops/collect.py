#!/usr/bin/env python3
"""Read-only, bounded host snapshot for the WEAVIA admin console."""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(os.environ.get("WEAVIA_OPS_DIR", "/opt/weavia-v2/var/ops"))
PROJECT = os.environ.get("WEAVIA_COMPOSE_PROJECT", "weavia-v2")
SERVICES = ("backend", "worker", "admin", "postgres")
SAFE_MESSAGES = {"WEAVIA Go API listening", "WEAVIA worker started", "worker shutdown failed",
                 "worker failed", "startup failed", "worker heartbeat failed",
                 "task event recording failed", "task run recording failed",
                 "task event cleanup failed", "object storage config not applied, falling back to local disk"}
UUID = re.compile(r"^[0-9a-fA-F-]{36}$")


def command(*args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=12, check=False)
        return result.stdout if result.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def write_atomic(path, value):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=ROOT, delete=False) as handle:
        handle.write(value)
        temp = Path(handle.name)
    temp.chmod(0o644)
    temp.replace(path)


def cpu():
    def counters():
        with open("/proc/stat", encoding="utf-8") as handle:
            values = [int(x) for x in handle.readline().split()[1:]]
        return sum(values), values[3] + values[4]
    before = counters()
    time.sleep(0.15)
    after = counters()
    total, idle = after[0] - before[0], after[1] - before[1]
    return round(100 * (1 - idle / total), 1) if total else 0


def memory():
    values = {}
    with open("/proc/meminfo", encoding="utf-8") as handle:
        for line in handle:
            key, value = line.split(":", 1)
            if key in ("MemTotal", "MemAvailable"):
                values[key] = int(value.strip().split()[0]) * 1024
    return values["MemTotal"], values["MemTotal"] - values["MemAvailable"]


def docker_bytes(value):
    match = re.match(r"([0-9.]+)\s*([A-Za-z]+)", value.split("/")[0].strip())
    units = {"B": 1, "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3,
             "kB": 1000, "MB": 1000**2, "GB": 1000**3}
    return int(float(match.group(1)) * units.get(match.group(2), 1)) if match else 0


def containers():
    names = [f"{PROJECT}-{service}-1" for service in SERVICES]
    stats = {}
    for line in command("docker", "stats", "--no-stream", "--format", "{{json .}}", *names).splitlines():
        try:
            row = json.loads(line)
            stats[row.get("Name", "")] = row
        except ValueError:
            pass
    result = []
    for service, name in zip(SERVICES, names):
        try:
            info = json.loads(command("docker", "inspect", name))[0]
            state = info.get("State", {})
            status, health = state.get("Status", "unknown"), state.get("Health", {}).get("Status", "unknown")
            restarts = info.get("RestartCount", 0)
        except (ValueError, IndexError, TypeError):
            status, health, restarts = "unknown", "unknown", 0
        stat = stats.get(name, {})
        try:
            cpu_percent = float(str(stat.get("CPUPerc", "0")).strip("%"))
        except ValueError:
            cpu_percent = 0
        result.append({"name": service, "state": status, "health": health, "restarts": restarts,
                       "cpuPercent": cpu_percent, "memoryBytes": docker_bytes(stat.get("MemUsage", "0 B"))})
    return result


def safe_logs(service):
    try:
        process = subprocess.run(("docker", "logs", "--since", "10m", "--tail", "200",
                                  f"{PROJECT}-{service}-1"), capture_output=True, text=True,
                                 timeout=12, check=False)
        lines = process.stdout + process.stderr if process.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        lines = ""
    result = []
    for line in lines.splitlines():
        if len(line) > 4096:
            continue
        if service == "postgres":
            message = "PostgreSQL 已就绪" if "database system is ready to accept connections" in line else "PostgreSQL 已停止" if "database system is shut down" in line else ""
            if message:
                result.append({"time": "", "level": "INFO", "message": message})
            continue
        if service == "admin":
            if "Configuration complete; ready for start up" in line:
                result.append({"time": "", "level": "INFO", "message": "后台 Web 服务已启动"})
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        message = entry.get("msg")
        if message not in SAFE_MESSAGES:
            continue
        task_id = entry.get("task_id", "")
        if isinstance(task_id, str) and UUID.fullmatch(task_id):
            message += " · " + task_id
        result.append({"time": str(entry.get("time", ""))[:40],
                       "level": str(entry.get("level", ""))[:16], "message": message})
    return result[-200:]


def main():
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o755)
    mem_total, mem_used = memory()
    disk = shutil.disk_usage("/")
    snapshot = {"capturedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                "cpuPercent": cpu(), "memoryTotal": mem_total, "memoryUsed": mem_used,
                "diskTotal": disk.total, "diskUsed": disk.used,
                "containers": containers(), "logs": {name: safe_logs(name) for name in SERVICES}}
    write_atomic(ROOT / "snapshot.json", json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n")
    if dt.datetime.now().minute % 5 == 0:
        keep_metrics(ROOT / "metrics.ndjson", snapshot, 7, 2100)
    if dt.datetime.now().minute == 0:
        keep_metrics(ROOT / "metrics-hourly.ndjson", snapshot, 30, 750)


def keep_metrics(path, snapshot, days, limit):
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    history = []
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines()[-limit:]:
            try:
                row = json.loads(line)
                if dt.datetime.fromisoformat(row["capturedAt"]) >= cutoff:
                    history.append(row)
            except (ValueError, KeyError, TypeError):
                pass
    history.append({key: snapshot[key] for key in ("capturedAt", "cpuPercent", "memoryTotal", "memoryUsed", "diskTotal", "diskUsed")})
    write_atomic(path, "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in history[-limit:]))


if __name__ == "__main__":
    main()
