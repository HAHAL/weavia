# V1 能力矩阵（实测校正）

探测日期：2026-10-20。只读模型列表；未发起付费出图。
详见 `PROVIDER_PROBE.md`。

## 1. 路由

| 能力 | 首选 | 兜底 | 说明 |
| --- | --- | --- | --- |
| F01 文生图（无参考） | AntDigital `qwen-image-max` | DashScope `qwen-image-2.1-pro` | 30 Credits 对应一次基础生成 |
| F01/F02 带商品参考 | DashScope `wan2.7-image` | `qwen-image-2.1-pro` / `wanx2.1-imageedit` | 需要 Image+Text |
| F03 整图改图 | DashScope `wan2.7-image` | `qwen-image-2.1-pro` / `wanx2.1-imageedit` | 指令式编辑 |
| F03 局部改图 | DashScope `wanx2.1-imageedit` | 无 | `description_edit_with_mask` |
| F03 扩图/去水印/超分 | `wanx2.1-imageedit` | 无 | V1.1 |

**关键：AntDigital `/v1/models` 的 `capabilities` 为 null，不能据此判断图片输入/mask；F01/F02 带参考图先走 DashScope。**

## 2. DashScope 可用图像模型

| model | 价格（CNY/张） | 输入 | 输出 | 能力 |
| --- | --- | --- | --- | --- |
| `wanx2.1-imageedit` | 0.14 | Image | Image | 局部/全图编辑、mask、扩图、去水印、超分 |
| `wan2.7-image` | 0.20 | Image + Text | Image | 文生图、组图、编辑、多图参考 |
| `wan2.7-image-pro` | 0.50 | Image + Text | Image | 旗舰版 |
| `qwen-image-2.1-pro` | 0.25 | Text + Image | Image | 生成 + 编辑、透明层 |
| `qwen-image-2.0` | 0.20 | Text + Image | Image | 生成 + 编辑 |
| `qwen-image-2.0-pro-2026-04-22` | 0.50 | Image + Text | Image | 满血版 |
| `wan2.5-i2i-preview` | 0.20 | Text + Image | Image | 图像编辑预览 |
| `image-erase-completion` | 未标价 | Image | Image | mask 擦除补全，不支持 prompt |

价格来自当前 Workspace 模型列表，可能随供应商调整；**quote 必须快照价格**。

## 3. 限制

- `wanx2.1-imageedit`：北京地域；2 RPS / 2 并发；无免费额度；结果 URL 24h。
- 已真实调用 `description_edit_with_mask` 一次：18s，1 张，992×992，约 0.14 CNY。
- 所有图片结果 URL 都会过期；Worker 必须立即下载到本地/OSS。
- 内容审核失败通常返回 `DataInspectionFailed`，映射为 `CONTENT_BLOCKED`，释放 Credits。
- AntDigital 的图像模型列表包含 `qwen-image-2.0/max/plus`、`wan2.6-t2i`、`wan2.7-image`；是否支持图片输入需真实请求验证。

## 4. 计费与 Credits

| 项 | 规则 |
| --- | --- |
| 免费额度 | 30 Credits，仅一次，覆盖一次 `qwen-image-max` |
| F03 Credits | 暂定 50/张；后台可调 |
| AntDigital | 按张计费；价格同步到 `ai_models` |
| DashScope | 按成功张数计费；失败不计费 |
| 失败 | 释放预占；套餐购买不退款 |
| 并发 | DashScope 2 并发；Worker 排队/429 |

## 5. 待验证

1. AntDigital `qwen-image-*` / `wan2.7-image` 是否支持图片输入；用一张商品图做一次真实请求。
2. DashScope `wan2.7-image` 是否支持 mask；若支持，可替换 `wanx2.1-imageedit`。
3. `wanx2.1-imageedit` 的尺寸限制与 mask 规范（建议 1024×1024）。
4. 两家失败码、超时、内容审核映射是否一致。
5. AntDigital 与 DashScope 同模型的价格/质量差异，决定默认路由。
