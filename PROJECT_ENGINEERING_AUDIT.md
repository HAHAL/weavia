# WEAVIA 当前工程状态审计报告

审计日期：2026-10-12（Asia/Shanghai）

范围：当前工作区静态审计、有限本地测试；未连接生产环境。当前分支 `phase/production-readiness-final`，基线提交 `78e88ed`。工作区在审计前已有多项未提交业务代码和文档变更，本报告按当前工作区观察，不能等同于基线提交或线上版本。

## 结论

工程已有可运行的多端骨架、Go 云端商业核心、PostgreSQL/River 任务链及 CI 集成测试；**尚不能据此宣称商业上线就绪**。带真实 AI 的付费交付至少受生成结果未进入自有持久存储、真实供应商未验收、生产迁移/恢复未演练阻塞。自助付费会员上线还缺支付、订阅变更和权益执行闭环。

下表中的“已实现”指代码存在，不代表生产验收完成；“待验证”指缺少本次可复现的运行证据。

| 维度 | 当前状态与证据 | 主要差距 |
| --- | --- | --- |
| 1. 目录结构 | `apps/{web,admin,desktop}`、`packages/{ui,shared,api-client,ai-core,task-engine,database,...}`、`services/backend`、`docs`；pnpm workspace + Turbo。 | 共享包中部分为 Mock 或骨架，须以实际调用链判定能力。 |
| 2. 前端 | Web/Admin 为 Next.js 15、React 19；Desktop 为 Tauri 2 + React/Vite/Router/Zustand，Rust 管本地 SQLite/文件/凭据。见各 `package.json` 与 `apps/desktop/src-tauri`。 | Admin 首页仍为占位指标；Web 下载页明确无安装包；部分 Web token 存在 `localStorage`。 |
| 3. 后端 | Go 1.26、Chi、pgx、River；独立 API、Worker、migrate 入口。见 `services/backend/cmd`。 | 真实 AI 执行在云端 Worker；与“本地客户端执行任务”的目标需要明确职责边界。Desktop 本地仅有 Mock 工作流。 |
| 4. 数据库 | 云端 PostgreSQL，Drizzle 迁移 `0000`–`0006`；Go 以 SQL/pgx 访问，部分 sqlc 生成代码；桌面独立 SQLite。用户/会话、套餐/订阅、Credits、任务、资产、角色/审计等表已建。 | 存在旧 `memberships`/`credits_wallets` 与新 `subscriptions`/`credit_accounts` 并存，需规定唯一商业读写源及迁移策略；生产数据副本上的升级、回滚和恢复未验证。 |
| 5. API | Go `/api/*` 涵盖认证、会员查询、Credits、工作空间、AI 任务、资产及管理端；`openapi.yaml` 存在；Web 通过 rewrite 转发，Admin 使用带 HttpOnly Cookie 的服务端代理。 | OpenAPI 请求体多为宽泛 object、错误响应覆盖不足；URL 无显式版本；契约漂移缺自动检查；无支付/订阅购买 API。 |
| 6. AI Provider | `internal/providers` 有 Ant Digital、DashScope 适配器和路由；数据库模型注册表用于报价/路由；`ENABLE_REAL_AI` 门禁。 | 阿里以外的腾讯、字节、Azure、AWS 尚无实现；真实付费调用、供应商幂等承诺和成本对账未验收。模型能力目前主要限单张 1024×1024 图片，视频等目标功能未见实现。 |
| 7. 用户 | 数据库支持注册、密码登录、会话/刷新、设备、桌面一次性授权码；Desktop 使用系统凭据库；后台 RBAC。 | Web 登录将 access/refresh token 存入 `localStorage`；缺少可见的邮件验证、找回密码、登录限流/滥用防护完整证据；这些需按公开上线范围评估。 |
| 8. 会员 | Free/Pro/Studio/Agency 套餐、订阅/权益表、`GET /membership`、后台改套餐价格。 | 仅注册时创建 Free 订阅；未见购买、续费、升级/降级、支付回调和权益限额（设备/并发等）在任务入口强制执行。 |
| 9. Credits | 新 `credit_accounts`、预留、确认/释放、流水、管理员调整；`user_id + idempotency_key` 任务唯一；集成测试覆盖模拟任务结算。 | 生成文件先只把供应商 URL/data URI 写入 `assets.object_key`，但可能确认 Credits；应在可持久读取后结算。缺少生产级对账、过期预留清理/告警、支付充值闭环。 |
| 10. 部署 | 后端多阶段 Dockerfile，Compose 提供 PostgreSQL/migrate/API/Worker；`docs/PRODUCTION.md` 与备份优先迁移脚本。 | Compose 主要是单机开发拓扑；生产需 Web/Admin、TLS、密钥管理、持久卷、备份恢复、观测及桌面签名/分发。现有资产共享卷限制跨主机扩缩容。 |
| 11. CI/CD | `.github/workflows/ci.yml` 有 TS lint/typecheck/test/build、Go test/vet、Rust test/check、PostgreSQL 迁移和模拟商业 E2E。 | 未见自动部署、桌面 Mac/Windows 打包签名、覆盖率门槛、安全/依赖扫描及生产发布门禁；本分支 push 不在列出的 CI 分支中（PR 仍触发）。CI 结果需以远端运行记录为准。 |
| 12. 测试 | Go 单元、Rust 本地层、Vitest、带 PostgreSQL/River 的模拟 E2E；`RC1_ACCEPTANCE_REPORT.md` 记载合成旧库迁移和 E2E 通过。 | 无可信整体覆盖率百分比；本机未执行 PostgreSQL 集成、Rust 全套、跨平台打包或真实 Provider 测试。Admin/Web 商业端到端测试稀少。 |

## 系统与数据流

`Web/Admin → Go API → PostgreSQL`；`Desktop → Go API`，本地项目/素材在 Tauri SQLite 与 App Data；`Go API → River → Go Worker → Provider`。Web `/api/*` rewrite 到 Go，Admin 的 `/api/admin/*` 代理持有 HttpOnly Cookie。云端 PostgreSQL 是认证、会员、Credits 与计费真相源；本地 SQLite 只管理本地创作数据。参考：`docs/ARCHITECTURE.md`、`services/backend/internal/httpapi/server.go`、`apps/web/next.config.ts`。

当前业务能力矩阵：图片生成/编辑有有限模型接入与云端任务链；AI 模特、换衣、主图等仅能按现有图片能力逐项验证，不应因 UI 文案或 Mock 流程判定已交付。详情页、款式裂变、短视频、视频换脸复刻、关键词视频，以及腾讯/字节/Azure/AWS 路由，未在云端执行链找到对应生产实现。`apps/desktop/src/services/local-data.ts` 的 Mock 不计费。

## 按优先级处理的问题

| 级别 | 问题 | 放行标准 |
| --- | --- | --- |
| P0 | 生成结果未复制到 WEAVIA 控制的持久存储，`RecordGeneratedAsset` 仅保存来源字符串；供应商链接过期会造成已扣费结果不可读。 | 输出校验、持久化、可读取检查与 Credits 确认形成可恢复流程；覆盖 Worker 重启与重复执行。 |
| P0 | 未做拟上线 Provider 的真实调用和成本/幂等验收。 | 每个启用模型在受控预算下完成成功、失败退款、超时/重复任务、资产读取及账单对账。 |
| P0 | 生产数据库迁移、备份恢复、共享资产卷与告警未在预生产副本验收。 | 备份/恢复演练、迁移前后数据核对、重启和容量故障演练通过。 |
| P0（自助付费范围） | 支付与订阅购买/续费/退款闭环缺失，权益未见强制执行。 | 订单、支付回调幂等、订阅状态与 Credits 发放/回收、设备/并发限额全链路通过。 |
| P1 | Web token 存 `localStorage`，Admin 另用 HttpOnly Cookie；身份策略不统一。 | 审查 XSS/CSRF 威胁并确定安全的 Web 会话方案，完成回归测试。 |
| P1 | API 契约宽泛，版本策略不明确；当前 `openapi.yaml` 多处请求体为任意 object。 | 定义字段 schema、鉴权/错误/幂等示例，加入契约差异检查。 |
| P1 | Provider 配置只检查至少一个 Key，数据库种子可同时启用多个 Provider。 | 上线前逐模型校验密钥、能力、地区、价格、开关；无 Key 模型不可报价/接单。 |
| P1 | 当前云端 Worker 执行真实任务，与目标中的“本地客户端执行任务”表述不一致。 | 产品/技术方案明确本地编排、云端调用/结算各自职责，避免密钥下发客户端。 |
| P2 | Admin 指标/若干页面仍为占位，桌面下载与双平台发布链缺失。 | 根据首发销售承诺完成必需页面和安装包发布/升级/签名验收。 |

## 本次验证与限制

- `GOCACHE=/private/tmp/weavia-go-cache go test ./...` 在 `services/backend` 通过；默认 Go 缓存目录受沙箱限制，首次无自定义缓存的命令失败，不是代码测试失败。
- 直接运行 Vitest：Web 1/1、Desktop 16/16、database 3/3 通过。未运行完整 pnpm workspace、Rust、带 PostgreSQL 的集成测试；本机未发现 `docker`、`psql` 命令。
- `RC1_ACCEPTANCE_REPORT.md` 记载了此前合成库迁移/E2E 结果，本次未复现。没有生产密钥或预算，因此未发真实付费请求。没有当前 CI 远端状态或线上运行证据。

## 审计依据

`README.md`、`docs/ARCHITECTURE.md`、`docs/PRODUCTION.md`、`RC1_ACCEPTANCE_REPORT.md`、各应用/后端 `package.json`/`go.mod`/`Cargo.toml`、`packages/database/drizzle`、`services/backend/openapi.yaml`、`services/backend/internal/{auth,commercial,generation,providers,httpapi}`、`.github/workflows/ci.yml`、`docker-compose.yml`、`apps/web`/`apps/admin`/`apps/desktop` 源码。文档中的历史验收和当前静态证据已分别标注。
