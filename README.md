# WEAVIA / 织维

WEAVIA 是面向电商创作者和团队的 Local-First AI 商品视觉生产工具。桌面端负责本地项目、素材、任务历史与生成结果，云端应用负责账号和商业能力，所有生成能力通过统一 Provider Layer 和 Task Engine 接入。

## 技术栈

- Backend：Go、Chi、pgx/sqlc、River、OpenAPI
- pnpm workspace + Turborepo + TypeScript strict（Web/Desktop）
- Desktop：Tauri 2、React、Vite、React Router、Zustand
- Web / Admin：Next.js App Router、React
- 数据：Cloud PostgreSQL；Desktop SQLite/rusqlite
- 测试：Go test、Vitest、Rust test

## 目录

```text
apps/desktop     Tauri 桌面客户端与 Local-First UI Shell
apps/web         官网、登录与用户中心入口
apps/admin       运营管理后台骨架
packages/ui      设计令牌与共享基础组件
packages/shared  跨端业务类型（Auth、会员、Credits、创作）
packages/api-client  类型安全的 HTTP 客户端边界
packages/ai-core Desktop 离线 MockProvider（不含 Cloud Provider）
packages/task-engine 通用任务状态机与 Mock Runner
packages/database PostgreSQL 的既有 Migration（保留数据与历史）
services/backend Go 模块化单体 API、Worker、OpenAPI 与 sqlc
packages/config 共享 TypeScript 配置
docs/design-reference 已确认的 Design v1.0 原型参考
```

## 环境要求

- Node.js 20.18+
- pnpm 11+
- Go 1.26+
- Desktop 原生开发需 Rust stable 与 Tauri 2 系统依赖
- 数据库开发需 PostgreSQL（仅运行迁移时必需）

## 安装与验证

```bash
pnpm install
cp .env.example .env.local
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cd services/backend && go test ./... && go vet ./...
```

## 启动

```bash
docker compose up --build              # PostgreSQL + Go API + River Worker
pnpm --filter @weavia/web dev       # http://localhost:3000
pnpm --filter @weavia/admin dev     # http://localhost:3001
pnpm --filter @weavia/desktop dev   # 浏览器 UI 开发
pnpm --filter @weavia/desktop tauri:dev # 原生窗口
```

Phase 1A 的 Demo 登录闭环需要 Web 与原生 Desktop 同时运行。Desktop 会打开系统浏览器，Web 使用 `WEAVIA Demo` 开发账户签发一次性 Authorization Code，再通过 `weavia://auth/callback` 返回客户端。Access/Refresh Token 不进入 URL，桌面凭据由系统 Keychain/Credential Store 保存。

Phase 1B 的原生 Desktop 会在标准 App Data 下创建 SQLite 与项目目录。项目页可导入 PNG/JPG/WEBP，并通过 MockProvider 生成真实本地结果文件；完全退出再启动后，项目、素材、任务和结果仍会存在。

Cloud AI Gateway 已迁移到 Go。真实调用默认关闭；Worker 必须同时配置 `ENABLE_REAL_AI=true` 与对应 Provider Key，Web/Desktop 永远不会获得 Provider Key。

## 数据库

复制环境变量并配置 `DATABASE_URL` 后执行：

```bash
pnpm db:generate
pnpm db:migrate
```

Schema 已覆盖用户、账户、会话、会员、套餐、Credits、设备、订单、Provider、模型、任务与运行记录。迁移不会在 `install` 或 `build` 中隐式运行。

## 扩展 Provider

在 `services/backend/internal/providers` 实现 Adapter，并由 Go Gateway 路由。Provider 密钥不得进入源码、日志、浏览器或 Desktop，仅由 Server Secret 环境或未来 Secret Manager 管理。

## 扩展任务

在 `packages/task-engine` 实现 `TaskRunner`，由 Repository 持久化任务，并遵循统一状态迁移。远程任务 ID、重试和结算信息必须附着于同一 Task，不按具体业务复制任务系统。

更多说明见 [ARCHITECTURE.md](./ARCHITECTURE.md) 和 [DEVELOPMENT.md](./DEVELOPMENT.md)。
