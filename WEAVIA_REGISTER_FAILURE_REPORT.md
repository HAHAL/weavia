# WEAVIA Staging Register Failure Report

日期：2026-10-12（Asia/Shanghai）  
服务器：`47.113.148.107`  
Backend：`01e49e9e6c4f322aa08a7edbd0210771af65dffd`  
Frontend：`3b4bdcf688804c052b3e3e651d951c71c7a575bd`

## 结论

注册请求确实到达 backend，但 backend 返回了未分类的 HTTP 500。前端显示“服务暂时不可用”是 backend 的通用错误响应，不是前端渲染或 Web 到 API 的连接失败。

当前最直接的根因是错误可观测性不足：`writeError` 对未包装的数据库错误统一返回 `UNKNOWN / 服务暂时不可用`，backend 日志没有记录实际 SQL 错误。因此 staging 当前可以确认“注册事务失败”，但无法从现有日志确定是哪一条数据库语句失败。

## 1. Docker Compose 状态

```text
weavia-admin-1      Up
weavia-backend-1    Up (healthy)
weavia-postgres-1   Up (healthy)
weavia-web-1        Up
weavia-worker-1      Up
```

Backend readiness：

```json
{"checks":{"database":"ok","queue":"ok","storage":"ok"},"status":"ready"}
```

## 2. Backend / migration 日志

Backend 日志只有启动信息，没有注册失败的错误堆栈：

```text
WEAVIA Go API listening address=:8080 real_ai_enabled=false
```

Migration 日志正常：

```text
River migrations complete versions=0
```

没有发现 migration crash、数据库连接失败或容器重启。

## 3. 数据库检查

目标表均存在，当前行数：

| 表 | 行数 |
| --- | ---: |
| `users` | 1 |
| `sessions` | 0 |
| `audit_logs` | 0 |
| `subscriptions` | 1 |
| `credit_accounts` | 1 |

注册复现后 `users`、`sessions`、`audit_logs`、`subscriptions`、`credit_accounts` 行数没有增加，说明注册事务没有提交，未留下半成品用户、session、订阅或 Credits 账户。

## 4. 注册请求复现

使用一次性 staging diagnostic 邮箱发送：

```http
POST http://47.113.148.107:3000/api/auth/register
Content-Type: application/json
```

响应：

```http
HTTP/1.1 500 Internal Server Error
```

```json
{"code":"UNKNOWN","message":"服务暂时不可用"}
```

## 5. SQL 分步诊断

在 PostgreSQL 单个事务中执行并最终 `ROLLBACK`，没有保留诊断数据。以下步骤全部成功：

- 插入 `users`
- 插入 `accounts` / password account
- 插入 free `subscriptions`
- 插入 `credit_accounts`
- 插入注册 `credit_transactions_v1`
- 插入 `audit_logs`
- 插入 `devices`
- 插入 `sessions`

这证明当前数据库 schema、关键表、free plan、Credits 注册写入路径和 session 写入路径在独立 SQL 诊断中均可执行；失败发生在真实 backend 请求路径，但具体数据库错误被应用吞掉了。

## 6. 影响判断

- Frontend 页面正常，Web 服务正常。
- Web API proxy 的 `/api/health` 正常；backend `/api/health` 与 readiness 正常。
- Provider、Worker、Credits 规则和数据库 schema 未被本次诊断修改。
- 注册失败事务没有产生持久化测试用户或半成品商业记录。

## 7. 修复建议（未执行）

1. 在 backend 注册入口记录结构化错误上下文（请求 ID、阶段名称、数据库错误分类），不要把所有内部错误只映射为 `UNKNOWN`。
2. 将注册流程拆分为可观测阶段：user、account、subscription、credit account、credit transaction、audit、device/session，并保留原始错误作为服务端日志；不要向客户端泄露 SQL 或凭据。
3. 用 staging 数据库执行与真实 backend 二进制一致的注册集成测试，覆盖成功、重复邮箱、审计失败和 session 创建失败。
4. 核对运行中的 `weavia-backend` 镜像是否确实由 Backend commit `01e49e9e6c4f322aa08a7edbd0210771af65dffd` 构建；当前服务器只记录部署版本文件，容器日志没有可验证的 binary commit 标识。
5. 在确认具体失败语句前，不建议直接执行迁移、删除数据、重建数据库或修改商业逻辑。

## 诊断范围

本次只读检查了 Compose 状态、backend/migrate 日志、目标表结构/行数，并执行了一次注册复现及一次最终回滚的 SQL 分步诊断。没有修改代码、没有重启服务、没有执行 migration、没有删除数据。
