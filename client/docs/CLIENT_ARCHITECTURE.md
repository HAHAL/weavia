# 客户端架构

## 边界

客户端独立于 Go 服务。浏览器预览与 Tauri 共用 React 页面、路由、Zustand 状态及 Mock Service。`src/services/api.ts` 是未来服务端请求的唯一入口，默认 `mock`。服务端负责认证、模型目录、Credits 账本、会员、订单、生成任务；客户端只展示其返回结果。不可在客户端保存供应商 API Key。

## 结构

| 目录 | 职责 |
| --- | --- |
| `src/components/ui` | 按钮、卡片、Dialog、Badge、状态组件；Button 使用 CVA/Slot，Dialog 使用 Radix 焦点管理，样式绑定 WEAVIA 变量 |
| `src/components/layout` | 单一 Sidebar、Topbar、工作区骨架 |
| `src/pages` | 页面及其局部交互 |
| `src/services` | Mock 任务、API Client、SQLite 适配 |
| `src/stores` | 跨页面状态及浏览器回退持久化 |
| `src/types` | 与 API 草案对应的主要业务类型、演示目录 |
| `src-tauri` | Tauri 2 壳、SQL / FS / Dialog / Log 插件 |

## 本地数据

当前 Tauri SQLite 数据库为应用数据目录的 `weavia.db`，`client_state` 表保存版本 1 状态快照。素材文件位于应用本地数据目录的 `assets/`，数据库记录相对路径、大小和 SHA-256。浏览器使用 `weavia.state.v1` localStorage，素材以 data URL 回退。诊断页日志使用 `weavia.logs.v1`，最多 500 条；Tauri 原生日志单文件 2 MB、保留 3 份。工作流画布使用 `weavia.workflow.v1`。这些存储在实现上彼此独立，未来应统一至 SQLite 的分表结构，并补迁移与跨文件事务。

Tauri 素材导入现在会复制到 `assets/{uuid}.{ext}`，记录相对路径、MIME、大小和 SHA-256，读取时校验哈希，删除时先删除文件再删除记录。缺少关联引用计数、事务化清理、回收站和“重新定位文件”恢复流程。浏览器预览仍以 data URL 保存在 localStorage，因此限制单图 2 MB。

## 任务与作品

当前 `src/services/tasks.ts` 仅执行定时 Mock 状态转换：Queued → Running → Succeeded，并创建作品版本占位。取消和重试是本地演示。真实任务需由后端分配任务 ID，客户端通过轮询或事件订阅同步状态。Credits 预估不进行本地扣费。

## 安全与诊断

API Client 统一 Base URL、15 秒超时、错误和响应状态日志；仅在内存中存在会话 Token 时允许真实请求。日志避免记录 URL 查询串、认证头、异常详情，写入前仍对常见凭证模式做遮盖。Tauri FS 写入/删除权限仅限应用本地数据目录 `assets/`；SQL 权限仍需在发布前审计。

## 设计依据

Figwright 已连接 `WEAVIA Desktop` 文件，读取 `WEAVIA Design System` 的 Light/Cream/Dark 变量以及 Dashboard `6:1402`。代码中的主题色、Sidebar 224/72、顶部栏 64、Dashboard 输入框圆角和内容顺序由该设计文件或用户需求确定。并未逐页逐像素核对所有 Figma 页面。

## 后续阶段

1. 后端确认 OpenAPI 草案、认证和任务状态协议。
2. 本地数据分表迁移、独立文件目录与恢复机制。
3. 实际媒体服务、工作流执行引擎和支付接入。
4. 原生日志轮转、敏感信息白名单和安装包签名。
