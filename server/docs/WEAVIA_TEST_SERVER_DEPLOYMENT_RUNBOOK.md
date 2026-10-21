# WEAVIA RC1 测试服务器部署手册

本文将 WEAVIA V1.0 RC1 在临时测试服务器上的部署经验固化为可重复流程。示例基线为：Ubuntu 24.04、Docker 29.9、Docker Compose v5.6、代码版本 `1120872`、服务器 `47.113.148.107`。

## 1. 环境要求

- Ubuntu 24.04 LTS，建议至少 2 CPU、4 GB 内存、40 GB 可用磁盘。
- root 或具备 sudo 权限的运维账户。
- 出站 DNS/HTTPS 网络；如果 Docker Hub 超时，使用 DaoCloud mirror。
- 80/443 端口供 Caddy 使用；测试时 3000、3001、8080 可仅绑定内网。
- Git 或已验证的代码归档包。部署前必须确认 `VERSION` 和目标 commit。

## 2. 初始化服务器

以 root 执行：

```bash
cd /opt/weavia
bash deploy/server/bootstrap-server.sh
bash deploy/server/server-check.sh
```

脚本会检查 Ubuntu 24.04，安装 Docker、Compose v2、curl 和 Python 3，启用 Docker 服务，并在 `/etc/docker/daemon.json` 配置：

```json
{
  "registry-mirrors": ["https://docker.m.daocloud.io"]
}
```

本次验证环境实际为 Docker 29.9，镜像源为 `https://docker.m.daocloud.io`。修改 daemon 配置后用 `docker info` 验证。

## 3. 部署项目

将已验证的 branch/commit 或代码归档包传输到服务器后：

```bash
cd /opt/weavia
cat VERSION
git rev-parse HEAD
docker compose config
```

本次 RC1 目标版本为 `1120872`。生产 Caddy 配置位于 `deploy/caddy/Caddyfile`，服务包括 `postgres`、`migrate`、`backend`、`worker`、`web`、`admin`、`caddy`。

Go builder 使用 `GOPROXY=https://goproxy.cn,direct`，解决中国网络环境下 `proxy.golang.org` 超时问题；这不会开启真实 AI。

## 4. 环境变量

在项目目录创建 `.env`，至少设置：

```dotenv
POSTGRES_PASSWORD=请使用随机强密码
STORAGE_SIGNING_KEY=请使用随机密钥
ENABLE_REAL_AI=false
ANTDIGITAL_API_KEY=
DASHSCOPE_API_KEY=
SMTP_HOST=请填写邮件服务主机
SMTP_PORT=587
SMTP_FROM=请填写发件地址
# 如邮件服务要求认证，还需设置 SMTP_USER 和 SMTP_PASSWORD
```

其他变量参考 `.env.example` 和 `docker-compose.yml`。`ENABLE_REAL_AI` 必须保持 `false`；AI key、支付配置和生产密钥不得提交到 Git。使用域名时设置 `NEXT_PUBLIC_API_URL`、`WEAVIA_WEB_ORIGIN` 及 Caddy 的 DNS 记录。

## 5. 启动流程

```bash
cd /opt/weavia
POSTGRES_PASSWORD="$LOCAL_POSTGRES_PASSWORD" STORAGE_SIGNING_KEY="$LOCAL_STORAGE_SIGNING_KEY" docker compose up --build -d
```

该命令仅用于隔离测试服务器。`deploy/production/deploy.sh` 已改为独立生产路径，要求外部 TLS PostgreSQL、备份与完整的生产环境变量，详见 [生产部署说明](PRODUCTION.md)。测试部署也可以分步执行：

```bash
docker pull postgres:17-alpine
docker pull caddy:2-alpine
docker compose build
docker compose up -d
docker compose ps
```

`migrate` 成功退出是正常现象；其他长期服务应保持运行。

## 6. 健康检查与日志

```bash
curl -fsS http://127.0.0.1:8080/api/readiness
docker compose ps
docker compose logs --tail=100 postgres backend worker web admin caddy
```

应看到 readiness 的 database、queue、storage 均为 `ok`，Backend、Worker、Web、Admin、Caddy 运行，且 Backend 日志显示 `real_ai_enabled=false`。

域名和 HTTPS 就绪后，人工验证：

- `https://weavia.com/`
- `https://admin.weavia.com/login`
- `https://api.weavia.com/api/readiness`

Admin 生产 Cookie 带 `Secure` 属性，因此直接使用 `http://IP:3001` 登录可能出现登录后回到登录页；应使用 Caddy 提供的 HTTPS 域名。Caddyfile 按域名匹配，不按裸 IP 匹配。

如需在隔离的临时测试服务器上通过 IP 使用 HTTP，先在 `.env` 中显式设置 `WEAVIA_ADMIN_ALLOW_HTTP=true`，然后只重建 Admin：

```bash
WEAVIA_ADMIN_ALLOW_HTTP=true docker compose up -d --build admin
```

该开关仅用于测试环境，会关闭 Admin 会话 Cookie 的 `Secure` 属性；测试结束后删除或设为 `false`，恢复 HTTPS 域名访问。

## 7. 常见问题

### Docker Hub 超时

确认 `docker info` 的 Registry Mirrors 包含 DaoCloud；先测试 `docker pull postgres:17-alpine` 和 `docker pull caddy:2-alpine`，失败时停止，不要直接启动完整栈。

### Go 依赖下载超时

检查 `services/backend/Dockerfile` builder 阶段包含 `ENV GOPROXY=https://goproxy.cn,direct`，然后执行 `docker compose build backend worker migrate`。不要修改 Go 业务代码绕过错误。

### Compose 配置或迁移失败

先执行 `docker compose config`，检查 `.env` 是否缺少 `POSTGRES_PASSWORD` 或 `STORAGE_SIGNING_KEY`。迁移失败时查看 `docker compose logs migrate postgres`，确认 PostgreSQL healthy、密码一致、磁盘可写；不要手工删除数据库卷。

### Admin 登录后不进入后台

确认账号已注册并被授予 `super_admin`，检查 `/api/admin/ai/catalog` 的权限响应。生产环境必须通过 HTTPS 域名访问，避免 `Secure` Cookie 在 HTTP IP 地址下失效。

### 真实 AI 或支付被意外启用

停止发布流程，检查 `.env` 和 Compose 渲染结果：

```bash
docker compose config | grep ENABLE_REAL_AI
docker compose exec backend sh -c 'test "$ENABLE_REAL_AI" = false && test -z "$ANTDIGITAL_API_KEY" && test -z "$DASHSCOPE_API_KEY"'
```

RC1 测试部署不得启用真实 AI、配置 AI key 或接入支付。

## 8. 回滚与证据留存

保留部署 commit、`VERSION`、`docker compose config`、`docker compose ps`、readiness 响应和关键日志摘要。回滚时使用已验证的旧代码包或 commit，重新执行配置校验和健康检查；不要使用破坏性数据库操作。
