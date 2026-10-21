# Computrix Provider

- Provider code: `computrix`
- Base URL: `https://maas-api.computrix.ai/v1`
- 协议：OpenAI-compatible
- 图片生成：`POST /images/generations`
- API Key 只存服务端加密表 `provider_credentials` / `channel_keys`
- 渠道：`Computrix MaaS`，默认 priority 120

已接入模型目录（图片）：

- qwen-image-2.0
- qwen-image-max
- qwen-image-plus
- qwen-image-2.1-pro
- wan2.6-t2i
- wan2.7-image-pro
- gemini-3.1-flash-image
- nano-banana-2
- nano-banana-pro

视频模型目录先登记，执行能力仍需视频 Adapter。

## 模型目录

- 模型列表：`https://computrix.ai/v1/models`
- 生成接口：`https://maas-api.computrix.ai/v1/images/generations`
- 两个域名用途不同，不能混用。

动态目录已验证并同步，例如：

- gpt-image-2.5-flare
- gpt-image-2.5-sunburst
- qwen-image-3.0
- qwen-image-3.0-pro
- wan3.0-video-prime
