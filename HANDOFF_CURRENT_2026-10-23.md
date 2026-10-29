# WEAVIA 当前调整交接（2026-10-23）

供其他工具继续开发使用。本文区分已推送代码、待确认方案、已知问题和验证边界。先读本文，再按需读原 `HANDOFF.md`；旧文档的部分建议已过时。

## 1. 工作目录与 Git

- 当前仓库：`/Users/jiangliu/Documents/weavia`，同时包含 `client/` 和 `server/`。历史上的独立客户端/服务端目录不是当前修改目标。
- 远端：`https://github.com/HAHAL/weavia.git`。分支：`feat/server-client-monorepo`。
- 最新已推送提交：`6b6d531 feat: add product creative workflow and isolated Codex assistant`；本地 HEAD 与 `origin/feat/server-client-monorepo` 一致。不能据此推断已合并到 `main` 或部署生产。
- 截至写入时，`client/docs/product/WEAVIA_CREATIVE_PARITY_PRD_V2.md` 是**未跟踪、未提交**的待确认 PRD。本文也是新交接文件；后续提交前重新查看 `git status --short`。
- 参考文档：`HANDOFF.md`（历史背景）、`client/docs/CREATIVE_TRIAL.md`（试运行）、`server/docs/CREATIVE_TASKS.md`（接口）、`client/docs/CODEX_INTEGRATION.md`（内嵌 Codex）。原交接中包含环境资料，勿再复制密钥和密码。

## 2. 用户已确定的产品边界

1. 主要用户是中国的电商运营人员，同时服务中国和海外电商。TikTok Shop 只是渠道之一。重点是商品图、宣传图、商品视频、宣传视频的生成、核对与交付；界面优先让新手按业务任务操作。
2. **DAG 始终在客户端执行，不迁到服务端。** 服务端负责有界的独立模型任务、账号、路由、Credits、存储与结果。客户端重启后恢复尚未提交的后续节点。
3. 内嵌 Codex 使用 WEAVIA 专属目录，不读取或修改用户本机已安装的 Codex；通过单独的模型网关 URL、模型 ID、服务 Key 配置。当前实现是客户端调用隔离进程，不等于 WEAVIA 服务端已提供统一 Codex 代理。
4. 目标是接近 `https://vi.91jiguang.com` 的商品视觉创作效果。具体对标口径在 PRD v2 中，**尚待用户确认**；目前不能宣称已达到竞品效果。

## 3. 已推送的代码：客户端

| 位置 | 已实现的内容 | 当前边界 |
| --- | --- | --- |
| `client/src/pages/Products.tsx`、`Home.tsx` | 商品资料、依据图；选择主图/场景图/宣传图、渠道、市场、语言、人群、模型、张数和参数，并提交创作资料快照 | 商品库在本机；通用生成不是成套任务 |
| `client/src/services/live.ts`、`client/src/pages/Tasks.tsx`、`Works.tsx` | 轮询云端任务，下载结果，按输出分别创建本机作品；作品核对与下载 | 核对状态本机保存；多输出部分失败的恢复仍有缺陷 |
| `client/src/pages/VideoStudio.tsx` | 可编辑分镜、Codex 分镜草案，将脚本带入创作台 | 无商品图生视频、分镜逐段生成和自动合成；草案不是成片 |
| `client/src-tauri/src/codex.rs`、`client/src/services/codex.ts`、`client/src/pages/System.tsx` | 独立 Codex app-server 进程，专属 `CODEX_HOME`/SQLite/工作目录；网关地址、模型、Key 设置；Key 存系统钥匙串 | 目标网关 Responses API 兼容性尚未端到端验证；正式包仍需带受验证引擎 |
| `client/src/styles.css` 等 | 创作资料、模型状态、视频、助手设置相关 UI | 页面可见不代表真实 Provider 已连通 |

现有图片任务最多请求 4 张，实际返回的每张结果单独保存。它们使用相同创作意图，不是 3/5/7 张不同用途、可逐张重试的商品套图。

## 4. 已推送的代码：服务端

- `server/services/backend/internal/generation/creative.go`、`generation/service.go`：接收 `creative` 商品及投放资料快照并校验；商品图片要求依据图；把已核实事实和禁止声明加入实际 Provider 提示词，保留原始运营描述。系统**不会自动核验商品事实**。
- `server/services/backend/internal/httpapi/server.go`：参考素材归属校验；登录保护的 `GET /api/ai/tasks/{taskID}/outputs/{index}` 下载接口，支持 Range，供视频等文件结果使用。
- `modelcatalog/service.go`、`routing/service.go`、`providers/dashscope.go`：文字生成视频适配和能力过滤；需要已配置的 DashScope 渠道、Key 与 `text_to_video` 能力。服务端继续只执行独立模型任务。
- 任务、Worker、Credits 和上传体系已有基础，但这次提交不代表真实模型渠道已经启用、生产已部署，或付费生成已验收。

## 5. 当前功能完成度

| 用户流程 | 现状 |
| --- | --- |
| 建商品并从商品卡进入创作 | 有；商品、素材、作品及核对状态主要保存在当前客户端 |
| 提交真实图片 | 代码路径已接；需 `VITE_API_MODE=live`、可用模型渠道、Key、Credits、存储和真实服务端 |
| 多图结果与任务历史 | 有基础流程；多输出保存和恢复不够可靠，不具备真正差异化商品套图 |
| 作品核对和版本 | 可标记核对状态、下载；“保存新版本”目前复制已有素材并修改提示词，不会重新生成 |
| Codex 分镜策划 | 有配置和调用代码；实际后端网关尚缺兼容性验收 |
| 视频成片 | 有文字生成视频适配、任务与下载代码；视频模型当前未开放，未有真实付费视频成功验收；图生视频和多镜头合成未做 |
| 平台发布 | 下载后人工发布；没有店铺授权和自动发布 |

## 6. 已发现的问题及处理顺序

### P0：试运行基础可信度

1. **账号隔离**：`client/src/stores/app.ts` 将商品、素材、任务、作品、核对状态持久化为全局 `weavia.state.v1`，未按用户/工作区隔离；退出登录仅清会话。同设备切换账号有看到彼此本机数据的风险。先设计分区、清理与旧数据迁移。
2. **演示模式和连接状态**：`client/src/services/api.ts` 默认 `mock`，登录仍调用真实 API，会报 `API_NOT_CONFIGURED`。`client/src/components/AuthShell.tsx` 的“服务已连接”只是显示 URL，非健康检查。明确演示入口与真实探活。
3. **可用模型与正式报价**：`client/src/pages/Home.tsx` 没有可用图片模型时仍可点生成；显示的 Credits 是本地估算。`server/services/backend/internal/quote/service.go` 正式报价仅支持单张 `1024x1024` 图片，不覆盖多张或视频。付费入口应以服务端可用性、正式报价、余额为准。
4. **多输出恢复**：`client/src/services/live.ts` 只要存在同任务任意作品，就可能把多输出任务当作已保存；失败的输出不一定补齐。需要按输出索引持久化、恢复、幂等下载和单项重试。
5. **真实模型验收**：目前没有完整的“真实生成 → 下载 → Credits 对账 → 重启恢复”证据。视频的模型名、时长、区域端点、价格要按实际服务商账号确认后，以受控预算做单任务验证。

### P1：对标体验缺口

- 缺 3/5/7 张不同用途的商品套图计划、逐张报价/重试和整套导出。
- 精修、广告图、详情页、六宫格、批量等缺各自专属输入和闭环；通用提示词不等于这些工具已完成。
- 缺真实商品图生视频与客户端多镜头编排/合成；现有文字生成视频须单独标识。
- 商品、作品与核对状态尚未跨设备同步。作品页“保存新版本”语义不实；live 模式下空状态“当前不会生成真实图片或视频”也不准确。
- 首页内容较多，核心提交按钮位置偏下；面向新手应先选择业务任务，再展开模型参数。

### P2：生产化

生产 HTTPS、存储、邮件与签名密钥、模型渠道/价格、桌面包签名公证、登录回调、监控仍需配置与验收。见 `server/docs/PRODUCTION.md` 和 `client/docs/CREATIVE_TRIAL.md`。旧文档里的 HTTP 测试地址不应当成生产地址；真实 Key 不能放在 `VITE_*` 前端构建变量。

## 7. PRD v2 与接手顺序

`client/docs/product/WEAVIA_CREATIVE_PARITY_PRD_V2.md` 是**待确认评审稿，不是已实现代码**。建议阶段为 M0 基础可信、M1 图片试运行、M2 视频试运行、M3 完整对标；末尾五项产品决策待用户确认：对标口径、视频口径、套图张数、跨设备同步、发布边界。

接手工具先让用户评审 PRD，然后将确认后的 M0 拆成页面状态、API 契约、数据迁移和验收项；从账号隔离、模型/报价门禁、逐输出恢复、真实单任务验收开始。M1～M3 按确认范围迭代。**不要实现服务端 DAG 执行器**：原 `HANDOFF.md` 中“DAG 服务端长期执行器”及 P1 服务端 DAG 的建议已被用户后续决定覆盖。

## 8. 已有验证及其边界

- 此前对 `6b6d531` 的检查：前端构建通过；前端既有测试 2/2 通过；lint 为 0 error、3 条已有 Hook warning；Rust check 与 Go build 曾通过。Go 测试有部分包通过，但整轮受本机沙箱监听限制及后续中断影响，**不能宣称全量 Go 测试通过**。
- 最近的 UI 审查运行在 `http://127.0.0.1:5173/`，连接本地假 API fixture。截图在 `/Users/jiangliu/.codex/visualizations/2026/10/22/01a16343-4b20-7a23-9843-e2b3ecb412a9/weavia-audit/`；这些只证明页面状态，不证明真实服务端、原生 Tauri、Codex 网关或付费 Provider 的端到端表现。fixture 和 Vite 进程已停止。
- 本次交接只写文档，未运行新测试、调用付费模型、部署生产或修改业务代码。

## 9. 路径速查

- 客户端：`client/src/pages/`（页面）、`client/src/services/`（API/任务）、`client/src/stores/`（本机状态）、`client/src-tauri/`（原生能力）。
- 服务端：`server/services/backend/internal/generation/`、`httpapi/`、`modelcatalog/`、`routing/`、`quote/`、`providers/`。
- 真实桌面构建需 `VITE_API_MODE=live` 和生产 HTTPS `VITE_API_BASE_URL`；具体步骤见 `client/docs/CREATIVE_TRIAL.md`。`VITE_*` 会进入安装包，不要放服务商主密钥。
