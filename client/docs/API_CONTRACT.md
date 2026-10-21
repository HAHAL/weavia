# API 契约草案

状态说明：**EXISTING** 已与后端确认；**PROPOSED** 本文提出，未确认存在；**MOCKED** 当前客户端有演示实现；**UNVERIFIED** 已知需求但路径与行为未核实。本次没有检查或修改 Go 后端，因此没有任何接口标记为 EXISTING。

`openapi/openapi.yaml` 定义路径、Method、Bearer 身份、请求/响应和统一 Error。默认分页 `cursor`（不透明字符串）+ `limit`（1–100，默认 20）；响应 `items` 与 `nextCursor`，无下一页时为 `null`。所有时间为 ISO 8601 UTC；ID 为服务端不透明字符串。客户端本地 UUID 不能视为云端 ID。

| 领域 | Method / Path | 状态 | 异步 | 本地持久化 |
| --- | --- | --- | --- | --- |
| Auth | POST `/auth/login`, POST `/auth/logout`, POST `/auth/refresh` | PROPOSED | 否 | 仅安全会话，不保存密码或 Token 明文 |
| User Profile | GET/PATCH `/me` | PROPOSED | 否 | 可缓存脱敏显示资料 |
| Subscription | GET `/subscription` | PROPOSED | 否 | 短期缓存 |
| Credits | GET `/credits/balance`, GET `/credits/ledger` | PROPOSED | 否 | 只读缓存；服务端最终一致 |
| Model Catalog | GET `/models` | PROPOSED；客户端目录 MOCKED | 否 | 能力缓存含版本号 |
| Skill Catalog | GET `/skills` | PROPOSED；客户端目录 MOCKED | 否 | 安装偏好本地；目录服务端 |
| Product | GET/POST `/products`, GET/PATCH `/products/{id}` | PROPOSED；本地 CRUD MOCKED | 否 | 本地优先，未来显式同步 |
| Asset | POST `/assets`, GET `/assets` | PROPOSED；本地导入 MOCKED | 上传异步可选 | 本地优先，文件与元数据分离 |
| Image Generation | POST `/generations/images` | PROPOSED；创建任务 MOCKED | 是 | 保存任务 ID、提示词、参数 |
| Video Generation | POST `/generations/videos` | PROPOSED；创建任务 MOCKED | 是 | 同上 |
| Task | GET `/tasks`, GET `/tasks/{id}`, POST `/tasks/{id}/cancel` | PROPOSED；状态 MOCKED | 是 | 本地任务快照 |
| Work | GET `/works`, GET `/works/{id}` | PROPOSED；占位作品 MOCKED | 否 | 本地缓存与文件映射 |
| Work Version | POST `/works/{id}/versions` | PROPOSED；本地版本 MOCKED | 可能异步 | 本地版本链 |
| Workflow | GET/POST `/workflows`, POST `/workflows/{id}/runs` | PROPOSED；画布和执行 MOCKED | 执行异步 | 画布定义本地 |
| Order | GET `/orders`, GET `/orders/{id}` | PROPOSED | 否 | 只读缓存 |
| Client Diagnostics | POST `/client/diagnostics` | PROPOSED | 否 | 用户确认前只在本地 |

## Credits 规则

服务端对每次生成请求返回 `creditReservationId`、预占额、最终结算额；失败或取消由服务端释放预占。账本类型：`RESERVED`、`CHARGED`、`RELEASED`、`PURCHASED`、`REFUNDED`、`ADJUSTED`。余额、订单、退款均以服务端记录为准；客户端不可自己决定最终扣费。需在后端确认幂等键、超时重试和重复回调处理。

## 任务规则

状态 `Queued`、`Running`、`Succeeded`、`Failed`、`Cancelled`。创建生成请求应携带 `Idempotency-Key`。任务详情返回进度 0–100、失败代码及可读说明、作品 ID 和服务端更新时间。客户端本地演示定时器不代表服务器执行能力。

## 同步策略

商品、素材、工作流采用本地优先；首次云同步前显示确认，上传时根据 `updatedAt` / 版本号做冲突检测，不能静默覆盖。账号、Credits、订单、模型目录采用服务端权威，离线时标记缓存时间。作品文件与元数据分别同步，必须验证完整性。后端实现与字段命名均待确认。
