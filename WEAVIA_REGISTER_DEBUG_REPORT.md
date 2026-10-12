# WEAVIA Registration Debug Report

日期：2026-10-12（Asia/Shanghai）  
目标环境：staging  
Backend：`01e49e9e6c4f322aa08a7edbd0210771af65dffd`

## 实施内容

仅增加注册诊断能力，未修改注册业务步骤、Credits 规则、Provider、Worker 或数据库 schema。

### 注册阶段日志

注册流程现在对以下阶段记录结构化 `slog` 错误：

- `password_hash`
- `transaction_begin`
- `user_create`
- `password_account_create`
- `subscription_create`
- `credits_create`
- `credits_transaction_create`
- `audit_log_create`
- `transaction_commit`
- `session_create`

日志字段：

- `request_id`：读取 HTTP request ID；
- `register_step`：失败阶段；
- `error_detail`：原始错误详情。

没有记录 password、access token、refresh token、secret 或 Provider key。

### 原错误链

- `auth.Error` 增加 `Unwrap()` 和可选 Cause。
- 注册失败通过 `%w` 包装，保留 `errors.Is/errors.As` 能力。
- HTTP 错误响应使用 `errors.As` 识别包装后的 `auth.Error`，重复邮箱等既有客户端错误码不被改变。

## 测试

通过：

```text
GOCACHE=/private/tmp/weavia-go-cache go test ./internal/auth ./internal/httpapi
GOCACHE=/private/tmp/weavia-go-cache go vet ./...
git diff --check
```

新增测试覆盖：

- 注册诊断错误保留原始 cause；
- 日志包含 `register_step` 和 `error_detail`；
- 日志消息不包含 password/token/secret 等凭据字段。

## 变更文件

- `services/backend/internal/auth/service.go`
- `services/backend/internal/auth/service_test.go`
- `services/backend/internal/httpapi/server.go`

## 未完成事项

本次只完成本地诊断代码和测试，未构建、部署或重启 staging backend。下一步需要在用户批准后，将这些诊断变更部署到 staging，再复现一次注册请求并读取带 `request_id`、`register_step`、`error_detail` 的 backend 日志。

## 安全说明

诊断日志允许记录数据库错误详情，但不记录用户密码、token、secret 或 Provider key。若底层数据库驱动错误未来包含敏感值，应在日志 sink 或错误分类层进一步脱敏。
