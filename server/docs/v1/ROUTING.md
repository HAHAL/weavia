# 多渠道路由（New API 风格）

## 数据

- `provider_channels`：渠道（Provider 账号/Key）、优先级、权重、自动禁用、冷却。
- `channel_keys`：渠道级加密 Key。
- `channel_models`：渠道支持的模型。
- `logical_models`：客户端看到的模型（名称/图标/价格/参数）。
- `logical_model_abilities`：逻辑模型 → 渠道模型绑定，priority/weight/health。
- `model_route_logs`：每次路由尝试。

## 路由

1. 客户端只发 `modelKey`。
2. 按 Ability priority 降序，同优先级按 weight 选渠道。
3. 只使用 enabled、Key 可用、未冷却的渠道。
4. 失败切下一个；`NETWORK_ERROR` / 429 / 5xx / 超时 / resource_busy 可切换。
5. 连续 3 次失败进入 60s 冷却。
6. 全部失败只返回“生成服务繁忙，请稍后重试”，不暴露 Provider。
7. 成功/失败写入 `model_route_logs`。

## 后台

`AI Studio → 渠道`：

- 新增渠道（Provider、名称、Base URL、Key、优先级、权重）
- 设置渠道 Key
- 调整优先级/权重
- 启用/停用
- 自动复制同 Provider 模型并绑定

`AI Studio → 模型 → 同步到客户端`：把平台 24 个模型同步成 logical models。

## 当前验证

- 平台模型：24（图片 10 / 视频 14）
- 逻辑模型：24
- 图片可用：7
- 正常渠道：AntDigital 主、AntDigital 备用（优先级 50）
- 故障注入：两个坏 Base URL 渠道 priority=200
  - 第 1 次 `NETWORK_ERROR`
  - 第 2 次 `NETWORK_ERROR`
  - 第 3 次成功
- 客户端最终收到真实 1024×1024 PNG，未看到渠道错误。

## 已知限制

- V1 只做 default 分组。
- 多 Key 轮询未做（每渠道单 Key）。
- DashScope 异步任务“已提交后先查状态再决定是否重提”尚未接入路由重试；当前只对提交/调用失败切换。
- 后台 Ability 手工增删/权重编辑页还没做；目前渠道创建自动绑定，模型同步自动补 Ability。
