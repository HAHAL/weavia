# WEAVIA Desktop

WEAVIA AI Commerce Studio 客户端原型。React 19、TypeScript 6、Vite 8、Tailwind 4、shadcn/ui 风格的 Radix/CVA 基础组件、Tauri 2。默认运行演示模式；**不会调用真实 AI 模型、支付或扣减 Credits**。

## 启动

要求：Node 26、pnpm 11、Rust/Cargo、macOS Xcode Command Line Tools。

```bash
pnpm install
pnpm dev                 # 浏览器预览，http://127.0.0.1:1420
pnpm tauri dev           # Tauri 桌面窗口
```

## 构建与验证

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm check:rust
pnpm tauri build
```

第一次运行 Playwright 前执行 `pnpm exec playwright install chromium`。本机通过 Homebrew 安装的 Chromium 不会被 Playwright 默认自动复用；本项目测试使用 Playwright 的浏览器缓存。`pnpm tauri build` 生成 `src-tauri/target/release/bundle/macos/WEAVIA Desktop.app`；目前未签名、公证或制作安装器。

## 导航

左侧保留工作页面入口，图片编辑、视频工作台和工作流位于可展开的「创作工具」；搜索位于侧栏顶部，侧栏底部只有「账户与设置」。页面内按「账户」和「应用设置」分组，包含会员套餐、Credits 明细、订单、登录与安全、偏好设置、日志与诊断。原有独立页面地址会跳转到对应分区。窄窗口下「创作工具」以弹出列表显示。

## 数据与后端

- 浏览器预览使用版本化 localStorage；Tauri 启动时把工作区状态同步到应用数据目录的 `weavia.db` SQLite。它保存商品、素材元数据、任务、作品、Skill 启用状态和主题。
- Tauri 素材文件复制到应用本地数据目录 `assets/`，SQLite 保存相对路径、大小与 SHA-256；读取时校验，删除素材时同步删除文件。浏览器预览回退到 data URL，单张限 2 MB。文件丢失会提示重新导入；自动重新定位原始文件尚未实现。
- 演示任务在约 3 秒后完成，作品只有占位预览与版本记录。关闭客户端会将未完成任务标记为失败。
- Image Editing 可本地调整亮度、对比度和旋转并导出 PNG；Video Studio 可编排分镜。两者均未接通 AI 编辑或视频渲染服务。
- 诊断页显示 localStorage 中最新 500 条日志；Tauri 同时写入原生日志，单文件 2 MB、保留 3 份轮转。诊断页尚未读取或清理原生日志文件。日志只记录事件名、状态和必要 ID，不写入认证头或 Token。
- `VITE_API_MODE=live` 与 `VITE_API_BASE_URL` 可开启 API Client，但当前没有认证实现，任何真实业务流程都不会自动切换。生产接入需按 `docs/API_CONTRACT.md` 完成并验证。

## 文档

- [客户端架构](docs/CLIENT_ARCHITECTURE.md)
- [接口契约](docs/API_CONTRACT.md)
- [页面与接口映射](docs/API_MAPPING.md)
- [OpenAPI 草案](openapi/openapi.yaml)
- [开发验收报告](docs/ACCEPTANCE_REPORT.md)
- [新增文件清单](docs/FILE_MANIFEST.md)
