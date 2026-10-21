# P1 状态

## P1a（已完成，待数据库执行）

- 新增正式迁移：`packages/database/drizzle/0008_v1_conversations_quotes_cloud.sql`
- 已登记 journal（idx 8），`drizzle-kit migrate` 会执行。
- 新增迁移测试：`packages/database/src/v1-migration.test.ts`
- **未在 PostgreSQL 执行**：当前环境没有 PostgreSQL/Docker；需在开发库执行并核对。

## Provider 真实探测（已完成）

2026-10-20，使用测试 Key 调用 `wanx2.1-imageedit`：

- 端点：`POST /api/v1/services/aigc/image2image/image-synthesis`
- function：`description_edit_with_mask`
- 结果：`SUCCEEDED`，约 18 秒，`usage.image_count=1`
- 输出：992×992 PNG，约 735KB
- 成本：约 0.14 CNY
- 结论：Key、端点、异步轮询、mask、结果下载均可用。

## 注意

- `drizzle/meta/0008_snapshot.json` 尚未生成；在补齐 snapshot 前不要运行 `drizzle-kit generate`，否则可能基于 0007 生成重复迁移。P1b 需要安装依赖后生成/核对 snapshot。

## P1b（已完成）

- `internal/conversation`：会话/消息 domain、Postgres store、单元测试。
- `internal/quote`：报价 domain、模型价格查询、quote→task 校验、单元测试。
- HTTP：`POST/GET /api/conversations`、`GET /api/conversations/{id}`、`POST /api/conversations/{id}/messages`、`POST /api/ai/quotes`。
- `POST /api/ai/tasks` 支持 `quoteId`，校验通过后创建任务并消费报价。
- `internal/providers/dashscope_edit.go`：`wanx2.1-imageedit` 异步提交/轮询/mask，已用 httptest 测试。
- 迁移 0008 增加 `wan2.7-image`、`qwen-image-2.1-pro`、`wanx2.1-imageedit` 模型种子。
- 纯文生图不再强制 Project/InputAsset；改图仍要求。

## 下一步

1. 在开发库执行 0008，验证表/索引/回滚。
2. P1b：conversations/quotes/invitations/storage 的 Go handler + repository。
3. P1c：DashScope adapter（异步、2 并发、mask）。
4. P1d：客户端 SQLite/导出导入/mask 编辑器。
5. P1e：云存 OSS + 存储包 + 最小后台。


## 服务器验证（2026-10-20）

- Ubuntu 26.04 + Docker 29.1.3 + Compose 2.40.3。
- Compose 启动 PostgreSQL、migrate、seed、backend、worker。
- `AI_MODE=mock` 下完整 HTTP 链路通过：登录 → 会话 → 报价 → 任务 → 轮询 → 输出 → 余额 970 → 账本 2 条。
- 修复：`POST /api/ai/tasks` 之前只读 body 幂等键，现在兼容 `Idempotency-Key` 头。
- 冒烟脚本：`scripts/v1-smoke.py`。


## 示例图库（2026-10-20）

- 新增 `showcase_items`（迁移 0009）与 `showcase.write` 权限。
- 公开 `GET /api/showcase` / 图片；管理 `GET/POST/PATCH/DELETE /api/admin/showcase`。
- 新增独立 Web 管理后台 `apps/admin`，Docker 服务 `admin`，Caddy `/admin` 反代。
- 客户端 `src/services/showcase.ts` 动态读取；本地 6 张图作为离线兜底。
- 测试服务器已入库 6 张示例图 + 2 个示例作品，客户端显示 8 张卡片。


## 统一运营后台（2026-10-20）

- 新 `apps/admin`：金色/奶油统一后台，不使用旧 Next.js 壳。
- 页面：仪表盘、用户、商业、AI Studio、创作任务、内容管理、数据分析、设置。
- 登录统一走 Go `/api/auth/login`；管理数据走 `/api/admin/*`。
- 用户状态/Credits、套餐、Provider、示例内容可操作。
- 测试服务器已部署 `admin` 容器，Caddy `/admin` 反代。
- 旧 `zhiweiProject/apps/admin` 未修改。


## 多渠道路由（2026-10-20）

- 新增 0011 迁移：channels/keys/channel_models/logical_models/abilities/route_logs。
- 客户端只发 modelKey；服务端按 priority/weight 选渠道。
- 失败自动切换，错误对客户端脱敏。
- 后台新增“渠道”Tab：新增渠道、设置 Key、优先级/权重、启停。
- 模型同步：平台 24 个模型同步到 logical models（图片 10 / 视频 14）。
- 真实故障注入验证：2 个坏渠道失败后第 3 个正常渠道成功。
