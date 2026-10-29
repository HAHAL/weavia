# WEAVIA 品牌素材

`weavia-concept-reference.png` 是确认采用的原始概念图。`weavia-icon-source.png` 和 `weavia-wordmark-source.png` 是从概念图提取的透明底素材。

- 客户端页面使用 `client/public/brand/` 下的图标和字标。
- 运营后台使用 `server/apps/admin/brand/` 下的相同素材。
- 桌面应用图标在 `client/src-tauri/icons/`，由 Tauri 图标工具从 `weavia-icon-source.png` 生成。

未来独立官网接入时，请使用本目录的素材。当前仓库没有独立官网 `apps/web` 的源码。

更新图标时，在仓库根目录运行：

```bash
client/node_modules/.bin/tauri icon brand/weavia-icon-source.png -o client/src-tauri/icons
```
