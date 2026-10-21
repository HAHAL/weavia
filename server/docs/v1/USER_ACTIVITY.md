# 用户 15 天活动

## 后台入口

`用户中心 → 用户行「活动」`

展示：

- 登录次数、成功次数、独立 IP
- 最近登录时间
- 模型请求数、最近请求时间
- 消耗 Credits、当前余额
- 登录记录：时间、IP、客户端名称、平台/版本、User-Agent、成功/失败
- 模型请求：时间、逻辑模型/上游模型、Provider、参数、状态、Credits
- 模型用量汇总：请求、成功、Credits
- 消费流水：时间、类型、变动、余额、关联任务

## 接口

`GET /api/admin/users/{userID}/activity?days=15`

- 默认 15 天，最大 90 天。
- 登录 IP 来自 `login_events.ip_address`，代理场景读取 `X-Forwarded-For` / `X-Real-IP`。
- 任务来自 `tasks`，金额来自 `tasks.cost`。
- 消费流水来自 `credit_transactions_v1`。
