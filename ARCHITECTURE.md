# WEAVIA Architecture

## 边界

```text
Desktop UI → Task Engine → AI Provider Registry → Provider Adapter
     ↓             ↓
Local projects   Task repository

Web/Admin → API Client → future cloud API → PostgreSQL
```

Desktop First 与 Local First 是硬约束：原始商品素材、项目文件、生成结果和可恢复任务记录以本地副本为主；云端只保存账号、会员、Credits、设备、订单、Provider 配置和必要任务元数据。提交 AI 任务时仅上传执行所需素材。

## 核心原则

- Provider Agnostic：页面和工作流只依赖 `AIProvider` 能力契约。
- Task Based：AI 模特、AI 商拍及未来视频共用任务生命周期。
- Capability Based：UI 面向图片生成、编辑、图生视频等能力，不面向厂商品牌。
- Ledger First：Credits 流水不可变，钱包余额是可校验汇总。
- Secrets Stay Secret：服务端密钥只来自环境；用户 BYOK 密钥进入系统安全存储。

## Desktop 本地项目

```text
<project>/
  project.json
  assets/originals/
  outputs/images/
  outputs/videos/
  thumbnails/
  cache/
  .weavia/local.db
```

## Desktop Auth（Phase 1A）

```text
Desktop → POST /auth/desktop/session → System Browser → Web DevAuthProvider
   ↑                                                       ↓
Session + Device ← code exchange ← weavia://auth/callback?code&state
```

- `@weavia/auth-core` 隔离 Authorization Code Store、一次性消费、5 分钟 TTL、opaque access/refresh token 和设备注册；开发期使用进程内 Store，生产环境替换为 PostgreSQL/Redis。
- Desktop 仅在内存保存预期 `state`，回调必须同时匹配 `weavia://auth/callback`、`code` 与 `state`。Token 永不进入 URL。
- macOS/Windows/Linux 的正式 Desktop 通过 Rust `keyring` 后端写入系统凭据库；稳定 `deviceId` 单独保存在应用数据目录，不与凭据混存。
- 启动时以 refresh token 旋转会话；并发刷新使用 single-flight。服务端 Logout 失败也不会阻止本地凭据清除。
- 当前 Provider 是 `DevAuthProvider`（`WEAVIA Demo / demo@weavia.local`），不接第三方 OAuth。

## 状态模型

统一任务状态支持 `pending → queued → uploading → running → downloading → success`，以及 `failed`、`cancelled`、`reconciling`。状态机拒绝非法跃迁；Provider 状态先归一化再进入业务层。
