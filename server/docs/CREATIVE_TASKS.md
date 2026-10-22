# 商品创作任务接口

客户端的商品库当前保存在本机。`POST /api/ai/tasks` 通过 `creative` 字段接收提交时的商品和投放资料快照，并把它写入任务的 `input` JSON。`GET /api/ai/tasks` 与 `GET /api/ai/tasks/{taskID}` 返回该快照。服务端对渠道、市场、语言、目标、商品长度和商品图片依据图做校验；所有参考素材必须属于当前用户。

示例（省略登录头、模型和尺寸等现有字段）：

```json
{
  "mode": "image_to_image",
  "prompt": "制作一张自然光下的商品宣传图",
  "creative": {
    "purpose": "ad",
    "channel": "TikTok Shop",
    "market": "美国",
    "language": "English",
    "audience": "年轻通勤人群",
    "product": {
      "localId": "客户端商品 ID",
      "name": "保温杯",
      "sku": "CUP-001",
      "verifiedFacts": "容量 500ml，不锈钢杯身",
      "forbiddenClaims": "不要声称医疗功效"
    }
  }
}
```

`creative.purpose` 可为 `hero`、`scene`、`ad` 或 `video`。图片任务选择了商品时必须有依据图；视频任务只能使用 `video`。服务端将资料与禁止声明附加到实际 Provider 提示词，但 API 响应的 `prompt` 保留运营人员输入的原始描述。该约束不是自动事实核验，客户端的作品核对仍是发布前必经步骤。

已完成任务的图片结果仍可从 `GET /api/ai/tasks/{taskID}` 中取得。视频结果只返回私有 `objectKey`，客户端从 `GET /api/ai/tasks/{taskID}/outputs/{index}` 以登录身份下载，接口逐任务校验用户身份与完成状态，支持 HTTP Range。这个文件接口也可用于图片结果，但当前客户端图片继续使用原有数据 URL 兼容逻辑。

视频路由只暴露有 DashScope 渠道、渠道 Key 和 `text_to_video` 能力的逻辑模型；没有配置时客户端不可提交视频。视频恢复使用同一渠道 Key。DAG 编排仍在客户端，服务端只执行单个模型任务。
