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
