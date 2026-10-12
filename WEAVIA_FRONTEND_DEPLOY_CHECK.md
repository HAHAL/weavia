# WEAVIA Staging Frontend Deployment Check

检查日期：2026-10-12（Asia/Shanghai）  
服务器：`47.113.148.107`  
当前 release：`01e49e9e6c4f322aa08a7edbd0210771af65dffd`

## 结论

前端页面没有更新的原因已经确认：本次 release 是后端/Phase 2 acceptance 发布，不包含 Web 设计修改；服务器 Compose 也没有 `web` 或 `admin` 服务，因此没有前端镜像被构建或启动。

本次检查未修改代码、未重启服务。

## 1. 服务器是否部署 `apps/web`

是，服务器 `/opt/weavia/apps/web` 目录存在，包含 `package.json`、`next.config.ts`、`app/layout.tsx`、`app/page.tsx` 等源码文件。

但存在目录不等于已运行前端服务；当前目录只是 git archive 解包后的源代码，没有对应运行容器。

## 2. Docker Compose 是否包含 web/admin 服务

否。服务器 `docker compose config --services` 输出为：

```text
postgres
migrate
worker
backend
```

`docker-compose.yml` 只定义 PostgreSQL、migration、backend、worker；没有 `web`、`admin`、Next.js 或前端反向代理服务。

## 3. 当前运行的 Web 镜像版本

没有运行中的 Web 镜像。

当前容器只有：

```text
weavia-backend-1
weavia-postgres-1
weavia-worker-1
```

当前镜像列表也只有 `weavia-backend`、`weavia-worker`、`weavia-migrate`、PostgreSQL，以及 acceptance 测试镜像；没有 `weavia-web` 或 Next.js Web 镜像。

## 4. `apps/web` 是否包含最新设计修改

服务器上的 `apps/web` 来自本次 `git archive` 的 release commit，因此只包含该 commit 时已提交的 Web 内容。

本地工作树中仍有未提交的 Web/营销设计修改，包括：

- `apps/web/app/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/login/**`
- `apps/web/app/signup/**`
- `apps/web/app/pricing/page.tsx`
- `apps/web/app/product/page.tsx`
- `apps/web/app/download/page.tsx`
- `apps/web/app/account/**`
- `apps/web/app/marketing-*.tsx`
- `apps/web/app/*.css`
- `apps/web/public/images/**`

这些修改在本地仍显示为 modified/untracked，没有进入 release archive，因此服务器不可能包含这批最新设计。

## 5. 本次 commit 是否包含 `apps/web` 修改

否。

执行 `git show --stat 01e49e9e6c4f322aa08a7edbd0210771af65dffd` 的结果为 23 个文件，主要是后端资产持久化、数据库迁移、验收脚本、CI 和文档；没有 `apps/web` 文件变更。

提交中唯一匹配 `web` 的路径是后端配置/代码上下文，不是 `apps/web` 前端目录。

## 证据摘要

服务器版本标记：

```text
01e49e9e6c4f322aa08a7edbd0210771af65dffd
```

服务器 Compose 服务：

```text
postgres migrate worker backend
```

当前运行状态：backend healthy、postgres healthy、worker running。

## 建议

要让 staging 前端更新，需要单独将包含 Web 设计修改的 commit 部署，并在 Compose/部署方案中增加 Web 服务（或由现有外部 Web/反向代理部署 Next.js 构建产物）。在未明确前端部署架构和目标 commit 前，本次不自动修改或重启任何服务。
