# TASKS FOR CODEX — WEAVIA 后台运营闭环（2026-10-24）

依据：Codex 只读审查报告（`/Users/jiangliu/.codex/visualizations/2026/10/22/01a16343-4b20-7a23-9843-e2b3ecb412a9/weavia-admin-audit-2026-10-24/REPORT.md`）+ 代码复核。
配套：[BRIEF_FOR_CODEX.md](./BRIEF_FOR_CODEX.md)、[HANDOFF_CURRENT_2026-10-24.md](./HANDOFF_CURRENT_2026-10-24.md)。

---

## 0. 分析：报告对了什么、漏了什么

### 已复核成立（代码定位）

| 报告结论 | 复核结果 | 根因 |
| --- | --- | --- |
| 切标签后分页消失 | 成立 | `enhanceTables()` 只在 `navigate()` 调用；`ai-tab`/`task-tab`/定价分组重绘直接改 `innerHTML` |
| 健康状态不同步 | 成立 | `checkService()` 只改顶部 `#serviceStatus`；设置页渲染时把当时文本写死 |
| 失败任务 Credits 显示成本字段 | 成立 | `AdminTasks` 只返回 `cost`；UI 直接展示，无预留/实扣/返还 |
| “低于红线 0”但成本未核实 | 成立 | `pricing.evaluate()` 对 `unverified` / `needs_duration` 放行，不参与拦截 |
| 视频价格未按时长 | 成立 | `cost = CreditCost × NumberOfImages × 分辨率倍率`，`Duration` 只进 Provider 请求 |

### 报告没提、但同样影响运营的点

1. **预留/实扣/返还没有数据出口**：`tasks` 有 `reserved_credits`、`consumed_credits`，但 `AdminTasks` 没查；失败释放记录在 `credit_transactions_v1`，后台不可见。
2. **任务没有失败码与渠道归因**：`tasks.error`、`model_route_logs`（含 key_id、channel、latency）都没进后台任务页。
3. **`billing_basis` 语义未暴露**：视频渠道按“提交数量”结算，图片按“实际交付”，后台没有标注，运营会误判。
4. **退款/取消完全缺失**：没有任何 admin cancel/retry/refund 接口，也没有幂等约束。
5. **审计覆盖仍不全**：路由、Key、定价、邀请码、渠道、角色有；**用户状态、OSS 同步开关、存储配置变更**没有。
6. **价格没有历史**：改价后无法回溯，只有审计里的 before/after，且是原样 JSON。
7. **客户端两条配置是“假生效”**：`clientAssetMode=cdn` 时后端不改写 URL；`syncShowcase` 只有开关，没有同步任务。
8. **迁移是同步请求**：数据量上来会超时，且没有进度。
9. **Seedance 售价 50 Credits 是占位**，成本按秒未核实；`image_to_video` 未开放。
10. **安全面**：HTTP + 真实 AI + 公网端口（你已做 IP 限制）；后台 Key 曾出现在对话里，需轮换。

### 报告里需要修正的两个数字/口径

- “99 条成本未核实”：当前是 **95 条 `unverified` + 按秒待换算**（总数随渠道模型增长会变），页面统计应实时查，不要写死。
- “低于毛利红线 0”：这个 0 是**在已核实成本里**的 0，必须和“未核实条数”并列展示，否则会被读成“全部健康”。

---

## 1. 决策门（先定，再动代码）

| 编号 | 决策 | 选项 | 影响 |
| --- | --- | --- | --- |
| D1 | 未核实成本的模型是否允许上线 | A. 允许但标注（现状） B. 默认禁止，需管理员显式豁免 | 决定 T4 的实现形态 |
| D2 | 按秒视频计价口径 | A. `Credits × 秒数` B. `Credits × ceil(秒/5)`（5 秒为基础单位） C. 档位价（5/10/15 秒各一价） | 决定 T5 与 quote |
| D3 | 失败任务退款策略 | A. 全额释放（现状） B. 上游已扣则保留成本 C. 人工审批后退 | 决定 T6 的 refund 语义 |

> 在 D1–D3 未定时，T4/T5/T6 只做“可配置开关 + 默认保持现状”，不要写死。

---

## 2. 可执行任务

### T1 · 统一渲染钩子，修复分页/排序丢失（P0，规模 S）

**现状**：`enhanceTables()` 仅在 `navigate()` 调用。

**改动**：
- `server/apps/admin/app.js`
- 抽出 `renderInto(target, html)`：赋值 `innerHTML` 后统一调用 `enhanceTables()`
- 替换以下位置：`ai-tab`、`task-tab`、`pricingGroup.change`、`showcase-filter`、`roles` 页重绘、`renderTaskBody()`、`renderAIBody()`
- `enhanceTables()` 增加 `data-table-id`，避免重复增强

**验收**：
1. 用户中心 → 角色权限 → 返回，分页条仍在
2. AI Studio 切 5 个标签，每个列表分页/排序可用
3. 搜索过滤后，分页总数随之变化
4. 同一表格重复渲染不出现两个分页条

---

### T2 · 健康状态单一数据源（P0，规模 S）

**现状**：`checkService()` 只更新顶部；设置页文本在渲染时固化。

**改动**：
- 引入 `state.health = 'checking' | 'ok' | 'down' | 'unreachable'`
- `checkService()` 只更新 state 并调用 `renderHealth()`，同时更新顶部与设置页节点（`#serviceStatus`、`#settingsHealth`）
- 设置页改为占位节点，不再内联文本

**验收**：
1. 设置页点「重新检查」→ 顶部与设置页在同一帧内显示相同状态
2. 断网/停服时两处都显示「服务不可达」
3. 刷新页面后两处一致

---

### T3 · 任务费用语义与详情（P0，规模 M）

**现状**：`AdminTasks` 只返回 `cost`；无失败原因、无渠道、无流水。

**改动**：
- `commercial.AdminTasks` 增加：`reserved_credits`、`consumed_credits`、`credit_reservation_id`、`error`、`billing_basis`（来自渠道模型）
- 新增 `AdminTaskDetail(id)`：任务 + 用户邮箱/账户 ID + 渠道/Key 末四位 + `model_route_logs` 最近 5 条 + `credit_transactions_v1` 该预留的 consume/release
- 后台任务表列改为：**预留 / 实扣 / 返还**，失败任务用红色标注“实扣 0”
- 任务详情抽屉展示上述信息

**验收**：
1. 成功任务：预留 = 实扣，返还 0
2. 失败任务：预留 = 返还，实扣 0
3. 部分成功任务：预留 > 实扣，返还 = 差额
4. 详情里能看到失败码、渠道名、Key 末四位、调用延迟

---

### T4 · 未核实成本的展示与可选拦截（P0，规模 S–M，依赖 D1）

**现状**：`evaluate()` 对未核实直接放行；定价页只显示“低于红线 0”。

**改动**：
- 定价页顶部增加两个并列数字：**已核实且低于红线** / **未核实（不参与拦截）**
- 新增设置 `block_unverified_models`（默认 false）：
  - false：现状
  - true：`pricing.CheckModel` 对 `unverified` 返回 422，文案说明“成本未核实”
- 加筛选：只看未核实 / 只看低于红线 / 只看按秒待换算

**验收**：
1. 开关关闭：行为不变，未核实模型可提交
2. 开关打开：未核实模型提交返回 422，错误码 `MODEL_COST_UNVERIFIED`
3. 页面数字与数据库查询一致（用 SQL 对照）
4. 两种状态都在审计里留痕

---

### T5 · 视频按秒计价（P0，规模 M，依赖 D2）

**现状**：`cost = credits × count × 分辨率倍率`，`duration` 不参与。

**改动**：
- `generation.Create` 计算：`cost = credits × durationFactor`（按 D2 选定的口径）
- `quote` 服务与任务快照写入 `duration` 与计价公式版本
- 后台定价页视频行显示“基础时长 / 单价 / 示例价（5s/10s）”
- 客户端价格预览同步（`Home.tsx` 的 `credits` 计算）

**验收**：
1. 5 秒与 10 秒任务，预扣金额符合选定口径
2. 任务详情记录 duration 与实际计价
3. 同一模型改价后，历史任务金额不变（快照生效）
4. 客户端显示与实扣一致

---

### T6 · 任务处置：取消 / 重试 / 退款（P1，规模 L，依赖 D3）

**现状**：无任何 admin 操作接口。

**改动**：
- `POST /api/admin/tasks/{id}/cancel`
  - 仅 `queued/running`；置 `cancelled`；释放预留；若已提交上游，调用 Provider 取消或标记“上游可能已扣费”
- `POST /api/admin/tasks/{id}/retry`
  - 复用原 `input` 新建任务，新幂等键，禁止复用旧预留
- `POST /api/admin/tasks/{id}/refund`
  - 仅 `success` 且已结算；写 `admin_adjustment` 流水；必须填原因
- 三个操作全部写 `admin_audit_logs`
- 幂等：重复调用同一操作返回 409 或原结果

**验收**：
1. 取消后预留归零，且只释放一次（重复调用不重复退）
2. 重试生成新任务 ID，旧任务不变，不发生重复扣费
3. 退款后余额与流水一致，审计可查操作人/原因
4. 越权角色（无 `credits.write`）调用退款返回 403

---

### T7 · 告警负责人、状态与通知（P1，规模 M）

**改动**：
- 新表 `channel_alerts(id, channel_id, level, message, status, owner_id, created_at, acked_at)`
- 后台「告警」页：列表、指派负责人、标记已处理
- 通知：飞书 webhook（环境变量 `ALERT_WEBHOOK_URL`），按 level 限流（同渠道 10 分钟一条）

**验收**：
1. 渠道连续失败 ≥ 阈值自动生成告警，不重复刷屏
2. 指派与处理状态持久化
3. webhook 可收到消息（本地可用 echo 服务验证）

---

### T8 · 对账报表（P1，规模 M）

**改动**：
- `GET /api/admin/reports/daily?from=&to=&groupBy=day|channel|model`
- 收入 = `consumed_credits × credit_cny_rate`；成本 = `model_route_logs.provider_cost`（若为 0 则用渠道成本估算并标注“估算”）；毛利与毛利率
- 页面：表格 + 趋势图（可用纯 CSS/SVG，不引新依赖）+ CSV 导出

**验收**：
1. 按日汇总与手工 SQL 一致
2. 成本为估算时明确标注
3. CSV 字段与页面一致

---

### T9 · 审计可读化（P2，规模 S）

- 把 `before/after` JSON 渲染成字段级 diff：`priority: 100 → 80`
- 过滤：动作、操作人、时间范围
- 空值不显示

**验收**：路由改优先级后，审计页显示中文可读差异；按动作筛选生效。

---

### T10 · 表格密度与无障碍（P2，规模 M）

- 渠道行操作收进「更多」菜单（保留 Keys / 模型 / 更多）
- 用户行同理
- 角色页复选框补 `aria-label` 与 `<label for>`
- 表头排序补 `aria-sort`

**验收**：键盘 Tab 可遍历；读屏能读出“为 X 账户分配 Super Admin”；每行主操作 ≤ 3 个可见按钮。

---

### T11 · 窄屏导航（P2，规模 S）

- 断点 ≤ 1280px 时侧栏折叠为图标 + `title`/`aria-label`
- 提供展开按钮，文字可回显
- 1024×768 下无横向滚动

**验收**：1024 宽下导航可辨认、可操作；不丢文字提示。

---

### T12 · 后续能力（不阻塞当前）

- 客户端 `cdn` 模式真正生效（后端按模式改写 URL）
- `syncShowcase` 同步任务
- 存储迁移改异步 job + 进度
- Key 级 RPM/日额度
- 价格变更历史表

---

## 3. 执行批次

| 批次 | 任务 | 目标 |
| --- | --- | --- |
| 第 1 批 | T1、T2、T3 | 修掉两个已复现界面问题 + 费用语义，当天可验收 |
| 第 2 批 | D1–D3 决策 → T4、T5 | 计费规则落地，避免返工 |
| 第 3 批 | T6、T7、T8 | 运营闭环：处置、告警、对账 |
| 第 4 批 | T9、T10、T11 | 体验与无障碍 |
| 第 5 批 | T12 | 规模化能力 |

## 4. 全局约束

- 不发起付费生成；视频调用必须单独授权
- 不改 DAG 执行位置
- 不提交 Key/AK/密码；不写 `VITE_*`
- 每个改动同时更新 `admin app.js` 与后端；UI 改动需附截图或录屏验收
- 迁移手工执行；部署走“现有镜像作底座 + COPY 二进制”
- 完成后更新 `HANDOFF_CURRENT_2026-10-24.md` 的验证边界与已知问题

## 5. 验收基线（每批必跑）

```
cd server/services/backend && go build ./... && go test ./internal/... -count=1
cd server && node --check apps/admin/app.js
后台设置页确认 BUILD_TAG 变化
关键接口用 curl 验证（含 403/422 分支）
```

## 6. 建议的第一条提交

`fix(admin): centralize render hook so tables keep paging and sorting` —— T1 + T2 合并提交，附前后对比截图。
