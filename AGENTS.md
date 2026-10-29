# WEAVIA 仓库约定

## 分支策略（2026-10-30 起）

- **只有一个主干**：`feat/server-client-monorepo`。不再开功能分支。
- 历史分支已打 tag 归档并删除本地引用：
  - `v0.1.0-import`（main）
  - `archive/admin-ops-first-batch`
  - `archive/client-experience-2026-10-27`
  - `archive/import-2026-10-22`
- `codex/client-experience` 只因 Codex 的 worktree `~/.codex/worktrees/admin-ops-first-batch/weavia` 占用而保留，不再开发。
- 小改动直接提交主干；大改动先在本机工作区完成、验证后一次性提交，不长期挂分支。

## 构建

- 客户端**必须**用 `npm run build:live`（会强制 `VITE_API_MODE=live` 并自检产物）。直接 `vite build` 会产出不能登录的 mock 包。
- `tauri build` 的 `beforeBuildCommand` 已指向 `build:live`，不要改回去。
- 桌面包内含 `Contents/Resources/codex`（Codex 引擎，250 MB，gitignored）。缺失时先跑 `node client/scripts/fetch-codex.mjs`。

## 发布

- 服务端：交叉编译 → scp → 以现有镜像为底座 `COPY` 二进制 → `docker compose up -d --no-build --no-deps <svc>`；每次先 `docker tag` 一个回滚锚点。
- 运营后台：源码在 `server/apps/admin`，改完 `docker compose build admin` 重建，不要只改容器内文件。
- 客户端：`npm run tauri build` 后必须重新 ad-hoc 签名（`codesign --force --deep --sign -`），否则 `codesign --verify` 会因资源未覆盖而失败。

## 已知边界

- 不用 mock 包交付；`VITE_ENABLE_VIDEO` 默认 false。
- 结果交付依赖对象存储读穿透，改 `assets` 或 `generation.Deliver` 后要回归“打开历史成功任务详情”。
- 头像、ops、admin 前端都曾只存在于其它分支；改动这些区域前先确认线上版本与仓库一致。
