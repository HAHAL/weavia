# WEAVIA Desktop Client V1

Tauri 2 + React 19 + Vite 桌面商业 Demo，支持 macOS 和 Windows。界面复用 `@weavia/ui` 的品牌样式，采用本地项目工作区与 SQLite 任务记录。

## 目录

- `src/app`：路由与应用入口
- `src/layouts`、`src/pages`：品牌界面、首页、创作、项目、素材、任务、账户和设置
- `src/services/auth*`：浏览器授权、Deep Link、会话恢复与系统安全存储
- `src/services/local-data.ts`：文件选择、本地项目与任务服务
- `src/services/cloud-ai.ts`：保留的 Provider 集成边界；V1 Demo 不暴露云端生成入口
- `src-tauri/src`：Tauri 命令、SQLite 数据与本地文件管理
- `src-tauri/capabilities`：文件对话框、外部浏览器与 Deep Link 权限

## 启动

从仓库根目录安装依赖，启动后端与 Web 用户中心，再启动原生窗口（分别在独立终端执行）：

```bash
pnpm install
POSTGRES_PASSWORD=choose-a-local-password STORAGE_SIGNING_KEY=choose-a-local-secret docker compose up --build
pnpm --filter @weavia/web dev
pnpm --filter @weavia/desktop tauri:dev
```

认证服务默认使用 `http://localhost:3000/api/`，可通过 `VITE_API_BASE_URL` 覆盖。浏览器完成登录后，`weavia://auth/callback` 会把一次性授权码交给桌面端。生产域名需同步更新 `src-tauri/capabilities/default.json` 的 URL allowlist 和 `src-tauri/tauri.conf.json` 的 CSP。

## 打包

在目标系统上分别执行。macOS 当前环境可生成 `.app`：

```bash
pnpm --filter @weavia/desktop tauri:build --bundles app
```

Windows 使用 `pnpm --filter @weavia/desktop tauri:build` 生成安装包，需在 Windows 构建机验证。打包产物位于 `apps/desktop/src-tauri/target/release/bundle/`。macOS DMG 在当前执行环境中因 `hdiutil` 返回“设备未配置”而未能生成；`.app` 已构建成功。macOS 发布需要 Apple 签名与公证；Windows 发布需要证书签名。签名、自动更新与分发尚未配置。

## V1 范围

浏览器登录与会话恢复、真实会员与 Credits 摘要、本地项目和图片导入、素材库、任务队列及四种状态均已接入。创作入口只开放本地 Mock 工作流，不调用模型 Provider，也不消耗 Credits。真实 AI Provider、自动更新和跨平台安装包验证留待下一阶段。
