# 客户端启动同步

## 协议

`GET /api/sync/manifest`（需登录）

返回资源版本：

- modelsVersion
- skillsVersion
- appsVersion
- showcaseVersion
- tasksVersion
- creditsVersion
- version（整体 ETag）

客户端发送 `If-None-Match`，未变化返回 `304`。

## 客户端行为

- 启动/恢复登录后调用 manifest。
- 本地缓存见 `weavia.sync.v1`。
- 版本一致时直接使用本地缓存，不拉全量。
- 变化时拉模型、Skill、AI 应用、Showcase、任务、Credits。
- 任务全量历史通过 `/api/ai/tasks` 拉取并合并。
- 网络失败时保留缓存并显示离线。
- 任务项包含 prompt，可直接显示历史标题。

## 当前缓存范围

服务端权威：模型、Skill、AI 应用、Showcase、任务、Credits。

本地数据：素材文件、作品文件、商品库（未云同步）。
