# WEAVIA Architecture

## 边界

```text
Desktop UI → Application Service → Local Repositories → SQLite
                       ↓                    ↓
                  Task Engine      Local project storage
                       ↓
              AI Provider Registry → Provider Adapter

Web/Admin → API Client → future cloud API → PostgreSQL
```

Desktop First 与 Local First 是硬约束：原始商品素材、项目文件、生成结果和可恢复任务记录以本地副本为主；云端只保存账号、会员、Credits、设备、订单、Provider 配置和必要任务元数据。提交 AI 任务时仅上传执行所需素材。

## 核心原则

- Provider Agnostic：页面和工作流只依赖 `AIProvider` 能力契约。
- Task Based：AI 模特、AI 商拍及未来视频共用任务生命周期。
- Capability Based：UI 面向图片生成、编辑、图生视频等能力，不面向厂商品牌。
- Ledger First：Credits 流水不可变，钱包余额是可校验汇总。
- Secrets Stay Secret：Provider 密钥仅由 WEAVIA Server 管理；Desktop 只持有 WEAVIA 用户 Session，Access/Refresh Token 继续进入系统安全存储而不是 SQLite。

## Desktop Local First 数据层（Phase 1B）

云端数据库与本地数据库是两个独立边界：Cloud 使用 PostgreSQL；Desktop 使用 SQLite。React UI 不执行 SQL，而是通过 `localData` Application Service、Tauri Commands 和 Rust `LocalData` Repository 聚合访问 SQLite 与文件系统。

SQLite 文件位于 Tauri `app_data_dir()/WEAVIA/weavia.db`。`schema_migrations` 保存已执行版本，每个升级通过事务按版本向前迁移。当前 migration v1 包含 `projects`、`assets`、`tasks`、`results`、`settings`，启用 foreign keys、WAL 和 busy timeout。

```text
<App Data>/WEAVIA/
  weavia.db
  projects/{projectId}/
  assets/originals/
  assets/processed/
  generated/images/
  generated/videos/
  cache/thumbnails/
  exports/
```

- Project 使用 UUID 主键，SQLite 保存生命周期和相对计数；统一 Storage Service 解析项目根目录和资源路径。
- Asset 长期保存项目内相对路径、SHA-256、MIME、尺寸与文件大小。导入使用临时文件、数据库事务和 atomic rename，永不移动或修改用户原图；项目内相同 hash 直接复用。
- Task 复用 `task-engine` 的状态定义并由 `SQLiteTaskRepository` 适配持久化。启动时遗留的 `pending/queued/uploading/running/downloading/reconciling` 会转为 `failed + INTERRUPTED`，避免永久卡住；用户可重新创建任务。
- Generated Result 同时注册为 `source=generated` Asset 和 Result，Result 记录来源 Task；真实文件写入 `generated/images/`。
- 删除项目先将目录原子移入 quarantine，再删除带外键级联的数据库记录，失败时恢复目录；提交后清理 quarantine，并显式报告文件清理失败。
- Settings Repository 保存默认项目路径、最近项目信息和基础 UI 偏好；敏感 Token 不进入 SQLite。

## AI Gateway、Control Plane 与 Data Plane

普通用户不配置、看见或持有 Provider API Key，也不需要 Computrix/OpenAI 等上游账号。未来调用链固定为 `Desktop → WEAVIA Cloud API → AI Gateway → Provider`。

- Control Plane：Desktop 与 WEAVIA API 处理 Auth、Membership、Credits、Task Metadata、Provider Router 和成本控制。
- Data Plane：图片/视频尽量由 Desktop 通过 Signed URL 直传临时对象存储，或直接使用 Provider Temporary URL；大文件不经 WEAVIA API Server 中转。
- 原始项目与下载后的最终结果长期保存在本地。云端媒体仅为 AI Task Temporary Storage，使用 TTL 和自动清理。Provider 有可靠临时结果 URL 时 Desktop 优先直下；只有必要时才经 WEAVIA Temporary Object Storage。
- WEAVIA Cloud Storage 是未来独立付费功能，不与任务临时存储混合。

Provider Adapter 与 Router 保持厂商无关。候选实现包括 `ComputrixProvider`、`OpenAIProvider`、`AlibabaProvider`、`VolcengineProvider`、`TencentProvider`、`AzureProvider`、`AWSProvider`；业务层不得直接依赖 Computrix，即使初期默认路由可能是 Computrix → GPT Image。

成本原则：metadata、hash、thumbnail 以及未来 resize/compression/EXIF cleanup 优先在客户端完成；上传前预处理超大原图；对象存储仅临时使用；路由依据成本、质量、延迟、成功率与可用性动态选择上游。初期云架构保持 API + Worker + PostgreSQL + Object Storage，任务队列 PostgreSQL-first，不强制 Redis、Kubernetes、微服务或 Elasticsearch。Credits 由服务端执行 Freeze → 成功 Consume / 失败 Release。

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
