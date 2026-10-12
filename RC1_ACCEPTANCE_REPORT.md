# 织维 RC1 验收报告

验收日期：2026-10-11  
分支：`phase/production-readiness-final`  
基线提交：`78e88edff7904cac60d0f23143bb21147dd720ba`  
结论：**暂不达到带真实 AI 生成能力的灰度上线标准**。数据库升级与模拟商业链路已通过；真实 Provider 验收和生成文件持久化仍是放量门禁。

## PASS 项目

1. **旧库升级与保数。** 使用临时 PostgreSQL 17.11，顺序执行 `0000`–`0005`，写入旧用户、Credits `available=123/reserved=7`、既有停用模型及 Drizzle 旧版本日志。使用仓库迁移器执行最终版 `0006` 后，用户和 Credits 未变化，原模型 UUID 与 `enabled=false` 保留。新增 3 个角色、5 项权限、3 个模型注册记录、审计表，`auth_requests.user_id` 可空，`task_status.reserved` 存在。
2. **重复执行安全。** 对同一升级后数据库再次执行 `drizzle-kit migrate` 成功；迁移日志仍为 2 行（旧版哨兵 + `0006`），角色、权限、模型数量和哨兵值未变化。这里验证的是应用迁移器重复运行；原始 SQL 文件本身不是可直接反复 `psql -f` 的幂等脚本。
3. **队列和模拟商业链路。** River 迁移成功（8 个版本）。`TestCommercialPostgresRiverE2E` 在最终迁移库通过，覆盖注册、登录、素材上传、任务创建和重复请求、Credits 预留、River 消费、模拟 Provider、生成资产记录、Credits 确认及关联完整性。
4. **代码回归。** `go test ./...`、`go vet ./...`、数据库包 TypeScript typecheck、3 个数据库包测试、迁移脚本语法检查及 `git diff --check` 通过。Provider、资产、生成和 HTTP API 的相关 Go 单元测试通过。
5. **真实调用前置配置路径。** API 和 Worker 均读取 Provider URL/密钥，任务创建与报价读取数据库模型注册表；队列 Worker 按已解析 Provider 路由，任务失败路径释放 Credits。`ENABLE_REAL_AI=false` 可阻止付费调用。

## 验收中发现并修复的阻塞 Bug

- 原 `0006` upsert 会把既有 `enabled=false` 模型重新启用。真实旧库哨兵复现后，已改为在冲突更新时保留原启停状态。
- 注册审计 SQL 的 UUID/文本参数类型冲突，以及审计 JSON 参数未显式定型，会令注册和 Credits 事务失败；已为参数显式定型并处理审计写入错误。
- 任务创建使用 `reserved` 状态，但旧枚举缺少该值；已在 `0006` 增加枚举值并同步 schema。
- 生成资产元数据 SQL 的参数类型不明会让任务卡在 `reconciling`；已显式转为文本。修复后数据库/River 集成测试通过。

以上仅为验收发现的阻塞 Bug 修复，未新增业务功能。修复与本报告当前留在工作区，尚未提交；基线提交单独部署仍会失败。

## FAIL / 未完成项目

1. **真实付费 Provider 调用：未执行。** 当前环境没有 `ANTDIGITAL_API_KEY` 或 `DASHSCOPE_API_KEY`、批准的花费额度及供应商响应样本。无法确认 `qwen-image-2.0` 的实际接口兼容性、响应格式、超时、供应商幂等承诺和计费。模拟 Provider E2E 不能替代该项。
2. **生成结果持久化：FAIL。** `RecordGeneratedAsset` 只把 Provider 返回的远程 URL 或 data URI 写入 `assets.object_key`／metadata，并未将生成图像落到自有持久存储。若供应商 URL 过期，或 data URI 不适合作为长期对象键，客户资产可能不可访问。当前 E2E 只验证资产行存在，不能证明文件可长期读取。这是带 AI 交付的灰度阻塞项。
3. **生产部署验收：未执行。** 本次使用合成旧库，不是生产数据副本；尚需在预生产副本上执行备份、迁移、恢复演练，并验证 API/Worker 共用持久卷、监控和告警。
4. **Provider 启停配置：需部署前确认。** `0006` 对新 Provider 的种子默认为启用。若只配置一个密钥，必须先停用无密钥 Provider/模型入口，再开放 `ENABLE_REAL_AI`；否则请求可进入失败后退款路径。

## 阻塞上线问题与灰度建议

**当前不建议开放 AI 付费灰度。** 先修复并测试生成文件的自有存储与重复结算场景；在有预算控制的预生产环境，对拟灰度的每个 Provider 至少完成一次真实成功、一次失败退款、一次重复请求/Worker 重启验证。随后用生产数据副本完成迁移和恢复演练，并核对模型/Provider 的启停、成本与密钥。

完成上述门禁后，先给内部账户或极小比例客户开放，限制并发与预算，监控 River 失败任务、`reconciling` 停留时间、Credits 预留/确认/释放差额、资产可读取率及 Provider 错误率。任一指标异常即关闭 `ENABLE_REAL_AI` 并停止扩大流量。

## 验收环境说明

临时 PostgreSQL 实例与合成数据库已停止并删除；为测试临时安装的 PostgreSQL/专用依赖已卸载，原 Homebrew OpenSSL 3 链接已恢复。Homebrew 安装时留下 `/opt/homebrew/var/postgresql@17` 和 `/opt/homebrew/etc/openssl@4`，未删除这两个可能承载用户数据或配置的目录。
