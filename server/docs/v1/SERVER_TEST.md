# V1 服务器测试记录

## 环境

- Ubuntu 26.04，4 vCPU / 7.3 GB / 40 GB
- Docker 29.1.3，Compose 2.40.3
- Docker Hub 不可达，使用镜像加速（`docker.1panel.live` / `docker.m.daocloud.io`）
- `AI_MODE=mock`，不调用付费模型

## 启动

```bash
cd /opt/weavia-v2
cp .env.example .env   # 写入 POSTGRES_PASSWORD / STORAGE_SIGNING_KEY / AUTH_VERIFICATION_SECRET
AI_MODE=mock docker compose up -d --build
```

PostgreSQL 首次启动会执行 `packages/database/drizzle` 下的 SQL；`migrate` 执行 River；`seed` 创建开发账号。

## 已验证

| 项 | 结果 |
| --- | --- |
| `/api/health` | 200 |
| `/api/readiness` | database / queue / storage 全部 ok |
| 开发账号 | `dev@weavia.local` / `weavia-dev-2026`，1000 Credits |
| 登录 | 200 |
| 会话/消息 | 200 |
| 报价 | 200，30 Credits |
| 任务 | 200 → `success`，1 个输出 |
| 余额 | 970（首次 smoke）；客户端任务后 910，冻结 0 |
| 账本 | 2 条（reserve + confirm） |
| 数据库 | conversations/messages/quotes/tasks/credit_transactions_v1 均有数据 |

## 冒烟脚本

```bash
python3 scripts/v1-smoke.py --base-url http://127.0.0.1:8080
```

## 端口

Compose 只绑定 `127.0.0.1:8080`。本机客户端联调用 SSH 隧道：

```bash
ssh -N -L 8080:127.0.0.1:8080 root@<server>
```

## 注意

- Docker Hub 被阻断时，需要配置镜像加速；`deploy/server/bootstrap-server.sh` 已兼容 Ubuntu 24.04/26.04。
- `0008_snapshot.json` 尚未生成；只运行 `drizzle-kit migrate`，不要运行 `drizzle-kit generate`。
- 服务器上的测试 Key 只用于开发，上线前替换。


## 客户端联调（SSH 隧道）

```bash
ssh -N -L 8080:127.0.0.1:8080 root@<server>
cd WEAVIADesktop
VITE_API_MODE=live VITE_API_BASE_URL=http://127.0.0.1:8080 ./node_modules/.bin/vite --port 1420
```

已验证：登录 → `/create` 提交 → 任务 success → 作品图 → 侧栏 Credits 从 970 刷新到 910。

客户端修复：

- `apiRequest` 统一拆 `{data: ...}`，否则登录 200 但 token 为 undefined。
- 任务完成后派发 `weavia:credits`，侧栏重新拉余额。
