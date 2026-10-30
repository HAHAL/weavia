---
name: weavia-feature-design
description: Design a WEAVIA feature's logic before coding — objects, state machine, money flow, failure paths, API, UI and acceptance. Use when the user asks how a feature should work, says they can't figure out the logic, or asks to design/spec a feature for the client, admin console or Go backend.
---

# WEAVIA 功能设计

把一个功能拆到「可以直接开发和验收」的程度。输出一份规格，追加到 `reviews/<日期>/feature-specs.md`（没有就新建），不要直接写代码，除非用户要求。

## 先读

- `CLAUDE.md`（硬规则、踩过的坑）
- `reviews/2026-10-30/acceptance-checklist.md`（验收格式）
- 相关代码：后端 `server/services/backend/internal/<领域>/`，路由 `internal/httpapi/server.go`，客户端 `client/src/services/live.ts` 与对应页面，后台 `server/apps/admin/app.js`

## 按顺序回答这 8 个问题

1. **谁、在什么场景、得到什么交付物**：一句话。用户是代运营 / 视觉工作室 / 品牌电商运营。
2. **对象与归属**：涉及哪些对象，挂在哪个已有对象下（项目 → 商品 → 批次 → 输出项 → 任务 → 版本 → 核对；账本）。优先复用已有表和字段（例：批次用 `conversations`），新增表要写迁移文件名。数据存服务端还是本机，按账号还是按工作区隔离。
3. **状态机**：列出状态和切换条件，每个状态在界面上显示什么文字。状态必须真实，不允许假进度。
4. **主流程 + 异常流程**：成功路径；以及失败、余额不足、断网、客户端重启、部分失败、重复点击、权限不足时分别怎么走。
5. **钱**：何时报价（服务端 `/api/ai/quotes`，与扣费共用 `generation.TaskCredits`）、何时预扣、何时确认、何时释放；幂等键怎么取，保证不会重复扣费。线下收款只走后台入账（凭证号去重）。
6. **接口与改动位置**：新增/修改的路由（方法、路径、权限）、迁移、客户端服务函数、页面、后台模块。写到文件级。
7. **验收标准**：按验收清单格式写「ID / 验收项 / 通过标准」，至少覆盖主流程、一个失败恢复、一个计费核对。
8. **不做什么**：这一版明确不做的边界。

## 约束

- 客户端构建只用 `npm run build:live`；后台改动要重建镜像；迁移手工执行。
- 未完成的能力从导航隐藏或标「未开放」，不做假成功。
- 涉及 AI 生成的功能，单独列一条质量验收：商品外观/包装文字是否被改、禁用声明是否出现。
- 用户想不明白时，先给推荐方案，再列一个备选和取舍，不要罗列很多选项。
