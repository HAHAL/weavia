# WEAVIA Registration Root Cause Report

日期：2026-10-12（Asia/Shanghai）  
服务器：`47.113.148.107`  
Frontend：`3b4bdcf688804c052b3e3e651d951c71c7a575bd`  
诊断 Backend commit：`8ba48f75c6f3fb190a1c6a0f7319881ce22d9acb`

## 结论

本次部署诊断版本后，使用同样的 Web 注册路径和有效测试数据复现，注册返回 HTTP 200，未产生 `registration failed` 日志。因此原始失败的具体 SQL 错误在当前环境中无法再次捕获。

当前能够被证实的根因是：staging 之前运行的 backend container image/runtime binary 与本次 auth 诊断 commit 不一致，导致前一次失败没有阶段日志且无法定位。替换为由 hotfix 编译的 Linux amd64 API binary 后，注册流程成功。

这不是对 Credits、Provider、Worker 或数据库 schema 的修复；本次只部署了诊断 binary。

## 部署过程中的额外发现

第一次尝试使用本机编译的 API binary 时，backend 日志出现：

```text
exec /usr/local/bin/api: exec format error
```

原因是本机 binary 架构与服务器不匹配。随后使用 `GOOS=linux GOARCH=amd64 CGO_ENABLED=0` 重新编译并替换 backend binary，服务正常启动。

## 最终 backend 状态

```text
weavia-backend-1   Up (healthy)
weavia-postgres-1  Up (healthy)
weavia-worker-1    Up
weavia-web-1       Up
weavia-admin-1     Up
```

数据库 migration 未执行，数据库和所有 volumes 保留。

## 注册复现结果

请求通过：

```http
POST http://47.113.148.107:3000/api/auth/register
```

响应：

```http
HTTP/1.1 200 OK
```

响应包含 access token、refresh token、用户和设备数据。凭据未写入本报告。

Backend 日志只有启动信息，没有失败日志：

```text
WEAVIA Go API listening address=:8080 real_ai_enabled=false
```

因此本次没有可提取的 `request_id`、`register_step`、`error_detail` 失败三元组；因为诊断版本没有失败。

## 数据影响

按用户授权执行了一次诊断注册，产生一个 `weavia.test` 测试用户及其正常注册关联记录。没有删除数据、回滚数据或执行迁移。

## 未解决问题

- 原始旧 backend image 在失败时没有记录具体数据库错误，因此无法证明旧失败对应哪条 SQL。
- 需要保留并核对后端 image digest/构建 commit，避免 `WEAVIA_BACKEND_DEPLOY_VERSION` 与实际运行 binary 不一致。
- 后续若仍需捕获失败，应在独立 staging 数据库或明确测试邮箱上制造受控失败，再读取结构化日志；不要在当前用户数据上删除诊断记录。

## 本次未执行

- 未修改业务逻辑。
- 未修改 Credits、Provider、Worker 或数据库 schema。
- 未执行 migration。
- 未重新部署 Web/Admin。
