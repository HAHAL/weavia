# Provider probe 2026-10-20

只读探测；未发起付费出图。未在仓库中保存 Key。

## AntDigital

`GET https://maas-api.antdigital.com/v1/models` → HTTP 200，分页返回。

图像相关 ID：

- `qwen-image-2.0`
- `qwen-image-max`
- `qwen-image-plus`
- `wan2.6-t2i`
- `wan2.7-image`
- `agentar_image_pro`
- `agentar_image_basic`

注意：列表 `capabilities` 为 `null`，不能据此判断是否支持图片输入/mask。需要真实请求探测。

## DashScope（Workspace `llm-wor137wxtmiutpep`）

`GET https://llm-wor137wxtmiutpep.cn-beijing.maas.aliyuncs.com/api/v1/models` → HTTP 200。

与 V1 相关的模型：

| model | 价格（CNY/张） | 输入 | 输出 | 说明 |
| --- | --- | --- | --- | --- |
| `wanx2.1-imageedit` | 0.14 | Image | Image | 局部/全图编辑，支持 mask |
| `wan2.7-image` | 0.20 | Image + Text | Image | 文生图、图生组图、图像编辑、多图参考 |
| `wan2.7-image-pro` | 0.50 | Image + Text | Image | 旗舰版 |
| `qwen-image-2.1-pro` | 0.25 | Text + Image | Image | 生成 + 编辑，支持透明层 |
| `qwen-image-2.0` | 0.20 | Text + Image | Image | 生成 + 编辑融合 |
| `qwen-image-2.0-pro-2026-04-22` | 0.50 | Image + Text | Image | 满血版 |
| `wan2.5-i2i-preview` | 0.20 | Text + Image | Image | 图像编辑预览 |
| `image-erase-completion` | 未标价 | Image | Image | mask 擦除补全，不支持 prompt |

`wanx2.1-imageedit` 文档明确支持：

- `description_edit`
- `description_edit_with_mask`（白=修改区、黑=保留区）
- `expand`、`remove_watermark`、`super_resolution`

限制：北京地域、2 RPS / 2 并发、无免费额度、结果 URL 24h。

## 结论

- F03 局部改图：`wanx2.1-imageedit`，已确认 mask 能力。
- F03 整图改图：优先 `wan2.7-image` / `qwen-image-2.1-pro`，`wanx2.1-imageedit` 兜底。
- F01/F02 带商品图：用 `wan2.7-image` 或 `qwen-image-2.1-pro`（均支持 Image+Text）；AntDigital 的图片输入能力待真实请求探测。
- AntDigital 仍可用于文生图；具体模型是否支持图片输入不能只看 `/v1/models`。


## 真实调用（付费，1 张）

2026-10-20 18:57 CST：

- endpoint: `POST /api/v1/services/aigc/image2image/image-synthesis`
- function: `description_edit_with_mask`
- result: `SUCCEEDED` in ~18s, `usage.image_count=1`
- output: 992x992 PNG (~735KB)
- cost: ~0.14 CNY
- conclusion: mask 链路可用；客户端需按实际尺寸（992）显示，不假设固定 1024。
