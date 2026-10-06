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

## Auth 骨架

Desktop 生成带 PKCE 的浏览器授权请求，Web 完成登录后通过一次性 code 回跳 `weavia://auth/callback`；Desktop 兑换 token，并将 refresh token 放入系统安全存储。本阶段只提供类型、页面和状态边界，不接 OAuth。

## 状态模型

统一任务状态支持 `pending → queued → uploading → running → downloading → success`，以及 `failed`、`cancelled`、`reconciling`。状态机拒绝非法跃迁；Provider 状态先归一化再进入业务层。
