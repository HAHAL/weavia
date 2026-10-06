# WEAVIA / 织维

WEAVIA 是面向电商创作者和团队的 Local-First AI 商品视觉生产工具。此仓库是 V1.0 Phase 0 的正式工程骨架：桌面端负责本地项目与创作，云端应用负责账号和商业能力，所有生成能力通过统一 Provider Layer 和 Task Engine 接入。

## 技术栈

- pnpm workspace + Turborepo + TypeScript strict
- Desktop：Tauri 2、React、Vite、React Router、Zustand
- Web / Admin：Next.js App Router、React
- 数据：PostgreSQL、Drizzle ORM
- 测试：Vitest

## 目录

```text
apps/desktop     Tauri 桌面客户端与 Local-First UI Shell
apps/web         官网、登录与用户中心入口
apps/admin       运营管理后台骨架
packages/ui      设计令牌与共享基础组件
packages/shared  跨端业务类型（Auth、会员、Credits、创作）
packages/api-client  类型安全的 HTTP 客户端边界
packages/ai-core Provider 契约、注册表与 MockProvider
packages/task-engine 通用任务状态机与 Mock Runner
packages/database PostgreSQL/Drizzle Schema 与连接模块
packages/config 共享 TypeScript 配置
docs/design-reference 已确认的 Design v1.0 原型参考
```

## 环境要求

- Node.js 20.18+
- pnpm 11+
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
```

## 启动

```bash
pnpm --filter @weavia/web dev       # http://localhost:3000
pnpm --filter @weavia/admin dev     # http://localhost:3001
pnpm --filter @weavia/desktop dev   # 浏览器 UI 开发
pnpm --filter @weavia/desktop tauri:dev # 原生窗口
```

## 数据库

复制环境变量并配置 `DATABASE_URL` 后执行：

```bash
pnpm db:generate
pnpm db:migrate
```

Schema 已覆盖用户、账户、会话、会员、套餐、Credits、设备、订单、Provider、模型、任务与运行记录。迁移不会在 `install` 或 `build` 中隐式运行。

## 扩展 Provider

在 `packages/ai-core/src` 实现 `AIProvider`，声明能力与模型，再注册到 `ProviderRegistry`。业务层只请求能力，不依赖云厂商 SDK。密钥不得进入源码、日志或浏览器环境；桌面用户密钥未来写入系统安全存储。

## 扩展任务

在 `packages/task-engine` 实现 `TaskRunner`，由 Repository 持久化任务，并遵循统一状态迁移。远程任务 ID、重试和结算信息必须附着于同一 Task，不按具体业务复制任务系统。

更多说明见 [ARCHITECTURE.md](./ARCHITECTURE.md) 和 [DEVELOPMENT.md](./DEVELOPMENT.md)。
