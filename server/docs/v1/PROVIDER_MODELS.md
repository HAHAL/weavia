# Provider 模型目录与 Key 管理

## 已接

- `GET /v1/models`（AntDigital）：实时拉取，支持 `limit=100` / `after` 分页。
- DashScope：有 Key 时走 `/api/v1/models`；无 Key 时用已探测清单兜底。
- 后台：`AI Studio → 模型` 展示显示名、模型 ID、Provider、模态、Credits、接入状态。
- 前台：`GET /api/ai/models?modality=image|video`，客户端按图片/视频过滤。

当前测试服务器实时结果（AntDigital Key 已配置）：

```text
平台模型 24 个
图片 10 个
视频 14 个
```

视频模型已列出，但视频生成适配器尚未接入，客户端标记“未接入”。

## Key 管理

- 后台 `AI Studio → Provider → 设置 Key`。
- Key 使用 AES-GCM 加密存 `provider_credentials`，只返回末四位。
- 运行时 Provider 从 DB 解密读取，不回传前端。
- 加密密钥由 `STORAGE_SIGNING_KEY` 派生；轮换该值会让旧 Key 失效，需要重新录入。
- 老环境变量 Key 仍可作为兜底。

## 真实 F01

- `qwen-image-max` 当前返回 `509 resource_busy`，Provider 侧资源忙。
- `qwen-image-2.0` 真实调用成功：1024×1024 PNG，客户端扣 10 Credits。
- 客户端上线默认先使用 `qwen-image-2.0`；`qwen-image-max` 保留在列表，Provider 恢复后可切回。
- 服务器已切 `AI_MODE=real`、`ENABLE_REAL_AI=true`。
