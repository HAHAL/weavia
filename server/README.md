# WEAVIA v2 — 后端核心

从 `zhiweiProject` 迁移出来的后端核心仓库。保留可复用的身份、积分、任务链与数据模型；后台 UI、Web、Desktop 不在此仓库。

## 目录

```text
services/backend     Go API / Worker / migrate（Chi + pgx + River）
packages/database    Drizzle 迁移与 schema
packages/shared      跨端业务类型
packages/api-client  类型安全 HTTP 客户端
packages/task-engine 任务状态机
packages/ai-core     离线 Mock Provider
packages/ui          设计令牌与基础组件
deploy/              Caddy / 生产部署脚本
scripts/             迁移与运维脚本
docs/                保留的架构与部署文档
```

## 启动

```bash
cp .env.example .env.local
docker compose up --build          # PostgreSQL + migrate + seed + API + Worker
cd services/backend && go test ./...
```

## 本地联调（Mock 模式，不调用付费模型）

```bash
AI_MODE=mock docker compose up --build
```

`AI_MODE=mock` 会启用内置 `MockProvider`，生成一张 1024×1024 PNG，但完整走
“预扣积分 → 写入本地素材 → 确认积分”的链路。`migrate` 完成后 `seed` 服务会创建开发账号：

```text
dev@weavia.local / weavia-dev-2026   （1000 Credits）
```

`AI_MODE=mock` 禁止在生产环境启用（`platform.Config.Validate` 会拒绝）。

## 与旧仓库的差异

- 不含 `apps/web`、`apps/admin`、`apps/desktop`；后台 UI 按新的 B 设计重做。
- 不含 `node_modules`、`.pnpm-store`、`.turbo`、`output`、`tmp`、设计截图。
- 旧仓库保持不动，作为归档。

详细取舍见 `MIGRATION.md`。
