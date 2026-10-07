# Development Guide

## 日常命令

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

建议只启动正在开发的应用，例如 `pnpm --filter @weavia/desktop dev`。根 `dev` 会并行启动三个应用。

## 环境变量

从 `.env.example` 创建本地文件。`NEXT_PUBLIC_*` 和 `VITE_*` 会进入客户端包，严禁放入任何 secret。Provider 服务端变量目前只是接口占位，不会发起真实调用。

## 数据库开发

1. 创建本地 PostgreSQL 数据库。
2. 设置 `DATABASE_URL`。
3. `pnpm db:generate` 生成 SQL migration。
4. `pnpm db:migrate` 应用 migration。

本轮不要求生产数据库，不提供默认密码，不在构建时联网。

## Desktop 本地 SQLite 与项目文件

Cloud PostgreSQL 与 Desktop SQLite 不共享连接或 migration。原生 Desktop 首次启动时在 Tauri 标准 App Data 路径创建 `WEAVIA/weavia.db`，并执行 `schema_migrations` 中尚未应用的版本。macOS 开发环境通常位于：

```text
~/Library/Application Support/com.weavia.desktop/WEAVIA/weavia.db
```

设置页会显示运行时解析出的确切路径。项目文件位于同目录的 `projects/{projectId}/`。不要把数据库、导入素材、生成结果或缓存复制进仓库；`.gitignore` 已排除 SQLite/WAL/SHM 与构建目录。

Rust 分层测试使用 `tempfile` 创建独立 App Data，覆盖 migration、Project CRUD/重启、Asset metadata/hash/去重/失败一致性、Task persistence/recovery、真实 Mock Result、级联删除与 Settings：

```bash
cd apps/desktop/src-tauri
cargo test
cargo check
```

真实验证需启动 Tauri，创建开发项目，导入 PNG/JPG/WEBP，运行 AI 模特 Mock Workflow，然后完全退出并重新启动应用，确认 Project、Asset、Task History 和 Generated Result 仍可读取。Mock Workflow 不请求真实 Provider，也不消耗 Credits。

## 代码约定

- TypeScript strict，不使用 `any` 或 `@ts-ignore` 绕过错误。
- 跨应用类型放入 shared；供应商行为放入 ai-core；任务编排放入 task-engine。
- UI 包只放基础视觉原语，不放 AI 模特等业务组件。
- 修改 Schema 必须生成 migration；修改任务状态需同步测试状态迁移。

## Desktop 原生层

`src-tauri` 提供应用/设备信息、稳定设备 ID、系统凭据库和 `weavia://` Deep Link。开发登录需要同时启动 Web 和 Tauri：

```bash
pnpm --filter @weavia/web dev
pnpm --filter @weavia/desktop tauri:dev
```

在 Desktop 的“账户”页选择浏览器登录，再在 Web 使用 Demo 账户授权。macOS 的 URL Scheme 在应用 bundle 中注册；`tauri dev` 的 scheme 归属会受本机 LaunchServices 缓存影响，完整验证优先使用 Debug Bundle。

开发期 Auth API 与授权码/Session Store 位于 Web Node 进程内，重启 Web 会让未完成授权和 refresh token 失效。这是开发 Provider 的明确边界，不用于生产部署。

## Phase 2A Cloud AI Gateway

Cloud API 复用 Web 开发进程：`http://localhost:3000/api`。Admin 位于 `http://localhost:3001`。启动：

```bash
pnpm --filter @weavia/web dev
pnpm --filter @weavia/admin dev
pnpm --filter @weavia/desktop tauri:dev
```

Health 与脱敏管理接口：

```text
GET /api/health
GET /api/admin/ai/providers
GET /api/admin/ai/models
GET /api/admin/ai/routing
GET /api/admin/ai/usage
```

从 `.env.example` 复制到被忽略的 `apps/web/.env.local` 或根 `.env.local`，只在 Server 环境填写：

```text
ANTDIGITAL_API_KEY=<server-only>
ENABLE_REAL_AI=true
```

不要把 Key 粘贴进聊天、Desktop、SQLite、日志或 Git。默认 `ENABLE_REAL_AI=false`，`pnpm test` 永不真实调用。真实验证应显式启动已配置环境，先进行一次最简单的 connectivity 请求，再进行一次 Desktop Workflow；最多 1–3 次必要请求。Health/Test Connection 只能检查 readiness，不能生成收费图片。

`qwen-image-3.0-pro` 当前仅按已确认的 OpenAI-compatible Text-to-Image contract 调用。参考图/Image Edit 必须等待 Ant Digital 官方字段确认，不能照搬其他平台字段。

Provider 数据库迁移：`packages/database/drizzle/0001_nice_wolverine.sql`。Cloud 开发存储当前与 Dev Auth 一样为进程内 Repository，Schema 已为 PostgreSQL 正式实现预留；生产持久化是后续部署工作。
