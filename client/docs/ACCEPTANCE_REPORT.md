# WEAVIA Desktop 开发验收报告

日期：2026-10-19（Asia/Shanghai）

## 项目检查

- 初始目录为空，既无 `package.json`、Tauri 项目，也不是 Git 仓库；未覆盖或删除既有文件。
- Node 26.12.0、pnpm 11.25.0、Rust/Cargo 1.97.1。
- Figwright 连接到 `WEAVIA Desktop`，读取了 Design System 的 Light/Cream/Dark 变量和 Dashboard `6:1402`。没有逐页核对全部 Figma 布局。
- 安装 `web-design-guidelines`、`react-best-practices`、`playwright` Skill。官方 Skill 列表 API 返回 403；改用已确认的 GitHub 仓库路径安装。

## 已真实实现

- Tauri 2 + React 19 + TypeScript 6 + Vite 8 客户端骨架，macOS 可执行文件构建成功。
- 单一 Sidebar（224/72 px）、18 个路由地址、Light/Cream/Dark 主题、共享 UI 基础组件（Radix/CVA 的 shadcn/ui 模式）和响应式布局。三项创作工具折叠，搜索位于侧栏，底部只有「账户与设置」；顶部栏已移除。账户与应用设置在同一页面分组展示，旧地址跳转到对应分区。
- Dashboard 对话创作表单：Agent、AI 分身、Skill 搜索与选择、模型能力说明、图片/视频参数、附件预览与移除、表单验证、Credits 演示预估、Toast。
- 商品创建/编辑/搜索/分类；素材导入、分类、预览、搜索、过滤、缺失提示与删除确认；Tauri 将素材文件复制到应用本地数据目录，并保存路径、大小和 SHA-256；Skill 管理目录和启用状态。
- React Flow 工作流画布：节点添加、移动、连接、选择、改名、删除、保存、载入和演示执行。
- Mock 任务的 Queued → Running → Succeeded，取消与重试；作品占位预览和版本追加。
- Image Editing 的本地 Canvas 亮度、对比度、旋转、PNG 导出与作品版本保存；Video Studio 分镜编辑、时长/画幅设置和演示任务提交。
- 账户、会员、Credits、订单、安全页的明确待接入状态；设置与本地诊断页。
- 统一 API Client、OpenAPI 草案、接口映射、架构文档。
- Tauri SQLite `client_state` 快照持久化；原生日志按 2 MB × 3 份轮转；浏览器预览 localStorage 回退。

## 已通过测试

| 命令 | 结果 |
| --- | --- |
| `pnpm lint` | 通过 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 2 个单元测试通过 |
| `pnpm test:e2e` | 此次改动的 3 个相关流程通过；此前完整 10 个流程通过 |
| `pnpm build` | 通过，工作流按路由拆包 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 通过 |
| `pnpm tauri build` | 通过，生成可执行文件及 `src-tauri/target/release/bundle/macos/WEAVIA Desktop.app` |
| 原生应用启动 | `.app` 成功打开首页；SQLite `client_state` 建表与读取成功，原生日志写入成功 |
| OpenAPI YAML 解析与内部 `$ref` 检查 | 25 条路径、108 个引用，均有效 |

Playwright 完整套件覆盖首页、Sidebar、导航、Skill、模型、参数、附件、图片/视频模式、校验、任务状态、作品与版本、商品、素材、画布节点、本地图片编辑、视频分镜、AI 应用预设、账户、Credits、设置、诊断，以及侧栏搜索和窄窗口创作工具入口。此次改动重点验证了账户与设置分区切换和首页入口。尚无真实后端集成测试与原生 SQLite 运行时自动化测试。

## 仅有 Mock

- 所有模型目录、Skill 目录与 Credits 预估均为演示数据。
- 生成任务通过浏览器定时器模拟。作品预览是占位，不包含生成的图片/视频。
- 工作流可编辑画布并演示执行状态，但无真实执行引擎。
- 商品、素材、任务与作品在本地演示存储，没有与 Go 后端同步。

## 需要后端支持

认证与安全会话、用户资料、模型/Skill 目录、图像/视频生成、任务状态、Credits 账本、会员与订单、支付、云端作品/工作流、诊断上传。所有 OpenAPI 路径标记为 **PROPOSED**，未确认任何 Go 后端接口已经存在。

## 尚未实现与风险

- AI 抠图、换衣、局部重绘、真实视频渲染与 AI 应用特定流程仍是待接入能力；当前图片编辑仅有本地基础调整，视频工作台仅可编排分镜。
- 商品多 SKU、图片关系与详情页尚未实现。素材已有独立文件目录与校验；自动重新定位丢失文件、跨数据库/文件事务、引用关系清理尚未实现。浏览器回退的 data URL 存储不适合大文件。
- SQLite 目前保存整份状态快照，缺少关系型分表、版本迁移和事务化文件操作。浏览器与 Tauri 数据互不自动同步。
- 诊断页在 localStorage 中显示 500 条；原生日志已做 2 MB × 3 份轮转，但诊断页尚不能查看、导出或清理这些原生文件，保留天数与完整敏感字段审计尚未实现。
- Auth 未接入，API Client 只有显式配置且在内存设置已认证会话时才允许请求。没有进行真实服务测试。
- `.app` 尚未签名、公证或制作 DMG；不能作为正式分发包。
- Tauri 原生应用已打开首页并验证 SQLite 初始化与日志写入，但尚未完成原生素材导入的自动化验证。原生 UI 工具在点击素材中心时失去窗口绑定，随后超时；没有据此宣称文件写入路径已在 UI 中实测。受限沙箱内启动会因日志插件无文件写入权限而失败；在本机应用权限下启动正常。

## 文件与命令

新增文件均在此目录：`package.json`、`pnpm-lock.yaml`、`vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`、`eslint.config.js`、`tsconfig.json`、`index.html`、`.gitignore`、`.env.example`、`README.md`、`src/**`、`src-tauri/**`、`tests/**`、`docs/**`、`openapi/openapi.yaml`。逐项清单见 [FILE_MANIFEST.md](FILE_MANIFEST.md)。未自动执行 Git commit 或推送。

主要执行命令：`pnpm add`、`pnpm add -D`、`pnpm peers check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:e2e`、`pnpm build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`pnpm tauri icon`、`pnpm tauri build`。初次 Rust/浏览器依赖通过用户提供的网络代理下载；依赖与浏览器现已安装。

## 下一步

优先确认 Go 后端接口与认证协议，然后完成本地分表、文件恢复与关联清理，再接入真实任务/作品与 Credits。之后补原生日志查看/清理、各业务页完整交互、安装包与端到端原生测试。
