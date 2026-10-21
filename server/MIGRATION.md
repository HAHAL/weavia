# 迁移说明

- 来源：`/Users/jiangliu/Documents/zhiweiProject`
- 基线提交：`6d39995`（2026-10-12）
- 迁移日期：2026-10-20

## 已迁移

| 内容 | 说明 |
| --- | --- |
| `services/backend` | Go API / Worker / migrate，约 5.8k 行 |
| `packages/database` | 8 个 Drizzle 迁移与 schema |
| `packages/shared/api-client/task-engine/ai-core/ui/config` | 共享类型、客户端、任务状态机、Mock Provider、设计令牌 |
| `deploy/`、`scripts/` | Caddy、生产部署与迁移脚本 |
| `docs/` | 架构、生产、测试服务器 Runbook、验收与进度 |
| 根配置 | package.json、pnpm workspace、turbo、tsconfig、eslint、compose |

## 未迁移

- `apps/web`、`apps/admin`、`apps/desktop`：后台 UI 按新设计重做，避免继承占位页。
- `node_modules`、`.pnpm-store`、`.turbo`、`output`、`tmp`、`.cache`：缓存与产物。
- `docs/design-reference`、`docs/screenshots`：约 18MB 设计参考，留在旧仓库。
- 根目录大量一次性报告（`WEAVIA_*_REPORT.md`）：留在旧仓库归档。

## 已知缺口（迁移前审计结论）

1. 生成结果只保存供应商 URL，未落自有对象存储（P0）。
2. Provider 仅 Ant Digital / DashScope，视频未实现。
3. 支付、订阅购买/续费/退款未闭环。
4. 后台 UI 除登录外均为占位页（已不在本仓库）。
5. 新旧表并存：`memberships`/`credits_wallets`/`credits_transactions` 与 `subscriptions`/`credit_accounts`/`credit_transactions_v1`。
6. Web token 曾存 `localStorage`（本仓库不含 Web）。
7. OpenAPI 请求体偏宽泛，缺少契约检查。

## 下一步建议

1. 定唯一积分/订阅读写源，清理旧表并重建迁移基线。
2. 生成结果落 S3/MinIO，校验可读后再确认 Credits。
3. Provider 层接 LiteLLM 或 New API，补视频任务。
4. 按新的 B 设计重做 admin，直接复用 `/api/admin/*`。
5. 接 Stripe/Paddle，补订单/回调/退款状态机。
