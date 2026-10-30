# CLAUDE.md

给 Claude / 任何接手本仓库的 AI 的工作约定。先读 `HANDOFF_2026-10-30.md`（现状、环境、未完成项），再读 `AGENTS.md`（构建与发布规则）。

## 项目一句话

WEAVIA：电商商品图生成与交付。Tauri 2 桌面客户端（React 19 + TS）+ Go 服务端（chi/pgx/River）+ 原生 JS 运营后台。

## 硬规则

1. **只有一条主干** `feat/server-client-monorepo`，不开功能分支。大改在本机做完、验证后一次提交。
2. **客户端构建只用 `npm run build:live`**。直接 `vite build` 会产出不能登录的 mock 包。
3. **桌面打包后必须重签**：`codesign --force --deep --sign - "<app>"`，否则 `codesign --verify` 会因 `Contents/Resources` 未覆盖而失败。
4. **服务端发布先打回滚 tag**：`docker tag weavia-v2-backend:latest weavia-v2-backend:pre-<改动名>`，再换镜像。
5. **后台是静态文件**：改 `server/apps/admin/**` 后必须 `docker compose build admin`，不能只改容器内文件。
6. **迁移不会自动跑**：新增 `server/packages/database/drizzle/*.sql` 后要手工 `psql -f`。
7. **不碰** `codex/client-experience` 分支的历史实现（客户端 105 文件重构），它和现在的实现重复。

## 验证闭环（每次改完都做）

```bash
cd client && npx tsc --noEmit && npx vitest run && npx eslint src
cd server/services/backend && go build -mod=readonly ./... && go test -mod=readonly ./...
```

UI 改动还要在浏览器里看：把 `client/dist` 用带 SPA fallback 的静态服务起在 **127.0.0.1:1420**（服务端 CORS 只放行这个端口和 `tauri://localhost`），再用 Playwright 走一遍、截图、记录 4xx/5xx。

## 容易踩的地方

- `generation.Deliver()` 默认不内联 base64：它只读本地盘，OSS 模式下会让所有成功任务详情 500。要开得设 `INLINE_OUTPUT_BASE64=true`。
- 报价与扣费共用 `generation.TaskCredits`（单价 × 张数 × 尺寸倍率）；改计价只改这一处。
- 客户端 0.2.0 起会读 `/api/client/config`：后台改 API 地址或调高最低版本会影响所有新客户端，先验证再保存。
- 客户端启动会恢复历史任务结果，必须限流（现为最近 3 条、间隔 600ms），否则 6 条连接被占满。
- 后台前端调用 `/api/admin/tasks/{id}` 等接口，改后端时注意别把已有路由名改掉。

## 代码地图（最短路径）

| 想改什么 | 去哪 |
|---|---|
| 页面/路由 | `client/src/main.tsx`、`client/src/pages/` |
| 与后端的交互 | `client/src/services/live.ts`（轮询、恢复、创建任务都在这） |
| 套图计划 | `client/src/components/OutputPlan.tsx`、`services/plan.ts` |
| 导出 ZIP | `client/src/services/export.ts`、`lib/zip.ts` |
| 后端路由 | `server/services/backend/internal/httpapi/server.go` |
| 生成/计费 | `internal/generation/`、`internal/commercial/`、`internal/quote/` |
| 后台 | `server/apps/admin/app.js` |

## 当前该做什么（按 HANDOFF §7）

1. 花 40 Credits 验证真实生成与套图提交（唯一"代码全绿但可能出不了图"的地方）
2. 改管理员密码、3001 限源
3. 按 `reviews/2026-10-30/release-0.3.0-acceptance.md` 验收 0.3.0（视频复刻需先在后台配置视觉模型）
4. 设计新功能前用项目 Skill `weavia-feature-design` 出规格
5. 再做 P2：批量 SKU、视频、模板市场、数据分析三维对账

## 提交信息

`feat|fix|refactor|docs|chore(scope): 描述`，一条提交只做一件事。
