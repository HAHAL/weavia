# `.weavia` 导出 / 导入格式 v1

## 目标

- 本地作品可导出，换设备导入，不依赖服务端。
- 云端作品可先下载到本地，再按同一格式导出。
- 导入不覆盖已有作品；冲突时保留双方。

## 包结构

```text
weavia-export-20261020.zip
├── manifest.json
├── works/
│   └── {workId}/
│       ├── meta.json
│       ├── cover.jpg
│       └── versions/
│           ├── {versionId}.png
│           └── {versionId}.png
├── assets/
│   └── {assetId}.{ext}
└── conversations/
    └── {conversationId}.json
```

## manifest.json

见 `export-manifest.schema.json`。最小示例：

```json
{
  "format": "weavia.export",
  "version": 1,
  "exportedAt": "2026-10-20T10:00:00Z",
  "appVersion": "0.2.0",
  "works": [
    {
      "id": "w_01",
      "title": "香水主图",
      "mode": "image",
      "createdAt": "2026-10-20T09:00:00Z",
      "versions": [
        {
          "id": "v_01",
          "versionNo": 1,
          "prompt": "白底商品主图",
          "file": "works/w_01/versions/v_01.png",
          "sha256": "…",
          "mime": "image/png",
          "size": 123456,
          "createdAt": "2026-10-20T09:01:00Z"
        }
      ]
    }
  ],
  "assets": [],
  "conversations": []
}
```

## 导出规则

1. 只导出本地存在的文件；云存但本地没有的版本，提示先“从云端恢复”，不导出空壳。
2. 写入 `manifest.json` 前计算每个文件的 SHA-256 和大小。
3. 路径必须使用 `/`，不得包含 `..`、绝对路径、符号链接。
4. 默认导出全部作品；可选“仅选中作品”。
5. 包名 `weavia-export-{yyyyMMdd-HHmm}.zip`。

## 导入规则

1. 校验 zip 大小上限（建议 2GB）与文件数（建议 10,000）。
2. 校验 `format=weavia.export`、`version=1`、每个 `file` 在包内且无路径穿越。
3. 校验 SHA-256；失败项跳过并记录，不整体回滚。
4. 作品按 `id` 去重：
   - 不存在：新增；
   - 已存在：**保留双方**，导入副本使用新 ID，标题加“（导入）”。
5. 会话按 `id`/`server_id` 去重；消息按 `client_message_id` 去重后追加。
6. 导入完成后显示：新增作品数、跳过数、失败文件数、失败原因。
7. 导入过程中不覆盖已有文件；先写临时目录，成功后原子移动。

## 安全

- 拒绝 zip bomb：解压后总大小上限、压缩比上限。
- 拒绝 `../`、绝对路径、符号链接、设备文件。
- 不执行包内任何脚本或 HTML。
- 导入的图片只作为文件读取，不在 WebView 中执行。

## 版本演进

- `version` 只增不减；新字段向后兼容，旧客户端忽略未知字段。
- 不兼容变更升 `version`，并提供迁移函数。
