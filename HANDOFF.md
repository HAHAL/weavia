# WEAVIA 开发交接（Codex）

更新时间：2026-10-22

## 1. 产品定位

WEAVIA 是面向商品视觉创作的桌面工作台：

```text
macOS 客户端（Tauri 2 + React 19 + TypeScript）
+ Go API / Worker
+ PostgreSQL + River
+ 管理后台（apps/admin）
+ 多 Provider 图片/视频模型路由
```

当前以邀请/积分模式运行，先做真实图片生成，再做视频和 DAG。

## 2. 仓库与运行环境

- GitHub：https://github.com/HAHAL/weavia
- 本地 monorepo：`/Users/jiangliu/Documents/weavia`
- 服务端：`server/`
- 客户端：`client/`
- 测试服务器 API：`http://8.160.190.182:8080`
- 管理后台：`http://8.160.190.182:3001`
- 测试账号：`dev@weavia.local` / `weavia-dev-2026`

服务端和客户端也可独立开发：

```text
/Users/jiangliu/Documents/weavia-v2      = server 原始仓库
/Users/jiangliu/Documents/WEAVIADesktop  = client 原始仓库
```

## 3. 重要安全约束

1. **不要提交任何真实 API Key。**
2. 当前 Provider Key 已配置在服务端数据库/环境，不在仓库里。
3. 不要再调用视频 Provider，除非用户明确要求并确认预算。
4. 视频模型目前在数据库中全部关闭。
5. 不要强制重写生产分支；当前 GitHub main 已同步。
6. 不要把 Provider/渠道信息展示到客户端任务中心（用户明确要求隐藏）。

已知需要轮换的密钥：

- Computrix API Key
- DashScope API Key

不要在代码、README、日志、测试快照中写入它们。

## 4. 当前功能完成度

### 已完成

```text
登录 / 注册
10 天免登录（refresh token，客户端 10 天上限）
启动同步（模型、Skill、AI 应用、任务、Credits）
模型缓存 v3
首页素材上传 / 从素材中心选择
素材中心
图片生成（真实 Provider）
Skill / AI 应用附加素材
图片编辑（wanx2.1-imageedit）
图片编辑保存为原作品版本
作品 / 生成记录 Tab
任务中心重构（统计、搜索、类型/状态筛选、详情）
任务 ID / 状态 / 错误原因（Provider 信息已隐藏）
卡通动漫头像 + 自定义头像
图片/视频参数分离
存储与 OSS 入口（仅入口）
```

### DAG 已完成

```text
React Flow 画布
输入 / 提示词 / 条件 / 人工审核 / 图片 / 输出节点
拓扑排序与环检测
分层并行执行
条件不满足跳过下游
人工审核暂停/继续
图片节点真实任务 + 缩略图
工作流图服务端保存/载入
工作流切换/删除
运行记录（状态、结果、错误）
```

### 视频

```text
DashScope Wan 异步 Adapter
单任务只提交一次 Provider
Provider Task ID 持久化
30 秒 reconciler（默认关闭，需 VIDEO_RECONCILE_ENABLED=true）
客户端视频参数 UI
客户端视频任务创建
客户端 <video> 预览
```

但：

```text
视频模型全部关闭
没有一条平台任务成功落库并播放的视频
视频 AI 应用未完成
```

### 未完成

```text
DAG 服务端长期执行器（目前执行在客户端）
视频 AI 应用
OSS 真实上传/同步/支付
生产 HTTPS
Windows 安装包
自动化回归测试
Provider 费用对账
```

## 5. 关键代码位置

### 服务端

```text
server/services/backend/internal/httpapi/           API 路由
server/services/backend/internal/generation/       生成任务、重试策略、积分
server/services/backend/internal/providers/        AntDigital / DashScope / Computrix
server/services/backend/internal/workflows/        工作流持久化
server/services/backend/internal/routing/          多渠道路由
server/packages/database/drizzle/                  migrations
```

### 客户端

```text
client/src/pages/Home.tsx             首页创作
client/src/pages/Tasks.tsx            任务中心
client/src/pages/Workflow.tsx         DAG 画布与客户端执行器
client/src/pages/ImageEditing.tsx     图片编辑
client/src/services/live.ts           云端任务、轮询、作品落库
client/src/services/tasks.ts          任务创建
client/src/services/sync.ts           启动同步
client/src/stores/auth.ts             登录/恢复会话
client/src/components/Avatar.tsx      头像
client/src/components/AssetPicker.tsx 素材选择
```

## 6. 数据库迁移

已应用：

```text
0001 ... 0013 Computrix provider
0014_workflows.sql
```

注意：`0008_snapshot.json` 缺失，不要盲目运行 `drizzle-kit generate`；新增迁移请手写 SQL 并更新 `_journal.json`。

## 7. 已踩过的重要坑

### 视频重复调用 / 费用

- 旧实现会在失败后自动切换渠道/重试，导致同一任务重复提交。
- 已改：`MaxAttempts: 1`，只使用第一个 binding，不自动重试。
- 新增 `providerTaskId` 持久化，但服务端恢复仍需完善。
- 视频模型必须保持关闭，直到超时、幂等、计费闭环测试完成。

### 任务同步

- 客户端同步层之前丢失 `providerTaskId`，且视频映射成图片。
- 已修：`sync.ts` 保留 mode/provider 字段，缓存 key 升级到 v3。
- 客户端任务中心不展示 Provider 渠道信息。

### 参考图上传

- 首页参考图需要 `projectId`，否则服务端返回“图片编辑任务需要项目和输入素材”。
- 已修。

### 视频路由

- `text_to_video` 不满足 `HasPrefix("video")`，曾导致视频走图片路由。
- 已修：使用 `strings.Contains(mode, "video")`。

### 登录

- 客户端启动原本强制清空 session。
- 已改为 10 天 remembered session；`main.tsx` 启动调用 `restore()`。

## 8. 下一阶段建议（按优先级）

### P0：视频闭环

1. 保持视频模型关闭。
2. 完成 Provider Task ID 在提交时持久化（已部分完成）。
3. 服务端长期 reconciler（默认关闭），或人工触发对账。
4. 单任务只提交一次，失败由客户端显示“重新提交”。
5. 只用一个低成本视频模型做一次人工测试。
6. 验证 MP4 落库、`<video>` 播放、作品保存。
7. 对账 14 次历史调用与 Provider 账单。

验收标准：

```text
一个平台视频任务
→ 只在 Provider 产生一次调用
→ 状态 success
→ MP4 可播放
→ Credits 只扣一次
```

### P1：DAG 服务端执行器

当前 DAG 执行在客户端，关闭客户端后不会继续。

需要：

- 服务端 run 执行器
- 节点状态持久化
- 调用 generation 任务并等待结果
- 失败/取消/恢复
- 条件分支、人工审核的服务端版本

### P2：视频 AI 应用

- 视频应用输入 schema
- 视频模型选择
- 视频结果预览/下载
- 视频应用发布流程

### P3：OSS

- 真实对象存储
- 跨设备素材同步
- 云端备份
- 套餐/支付
- 迁移本地素材

### P4：生产化

- HTTPS
- 轮换 Key
- 管理员密码
- 关闭开放注册
- Windows 构建
- 回归测试

## 9. 构建命令

服务端：

```bash
cd server
cp .env.example .env
docker compose up --build -d
```

客户端：

```bash
cd client
pnpm install
VITE_API_MODE=live VITE_API_BASE_URL=http://8.160.190.182:8080 pnpm tauri build
```

当前 macOS 包：

```text
/Users/jiangliu/Documents/WEAVIA-Desktop-0.1.0-macos.zip
SHA-256: ba59b097c3bdd89132735f2f22612aaf1651935076163d6bae5aac28dc5b7c88
```

## 10. Codex 开始工作前

请先：

1. 阅读本文件。
2. 检查 `git status`，不要覆盖未提交改动。
3. 不要调用模型 API。
4. 不要开启视频模型。
5. 不要提交 `.env`、Key、Token。
6. 修改后运行 `tsc`、相关 Go 测试和 Playwright 非模型测试。
7. 涉及数据库时手写迁移，不要依赖缺失的 0008 snapshot。

## 11. 当前明确不能宣称完成的部分

```text
视频生成闭环
视频 AI 应用
DAG 服务端长期执行器
OSS 实际存储/支付
生产 HTTPS/Windows
```

如果 Codex 要继续开发，先处理 P0，再处理 P1。
