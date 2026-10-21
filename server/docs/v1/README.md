# WEAVIA V1 — P0 设计包

状态：评审稿，未执行迁移、未改业务代码。
日期：2026-10-20

## 已确认决策

- 品牌：金色；客户端由 Codex 后续改版。
- 作品/素材：本地 SQLite + 本地文件为事实源；云端只做付费备份。
- V1 范围：F01 主图、F02 场景图、F03 参考改图（整图 + 局部 mask）。
- 供应商：AntDigital 文生图；DashScope `wan2.7-image` / `qwen-image-2.1-pro` / `wanx2.1-imageedit` 做带参考图与改图/mask。
- 额度：免费 30 Credits，每个账号一次；邀请制注册。
- 云存：V1 同时做，10GB / 30 天存储包，后台手动开通。
- 不做：海报套图、详情页、模特/换衣、视频、批量 SKU、团队权限、在线支付。

## P0 文件

| 文件 | 用途 |
| --- | --- |
| `ERD.md` | 服务端/本地数据模型、状态机、约束 |
| `ddl/0008_v1_server.sql` | 服务端 DDL 草案（P0） |
| `../../packages/database/drizzle/0008_v1_conversations_quotes_cloud.sql` | P1 正式 Drizzle 迁移（已登记 journal，未执行） |
| `ddl/rollback_0008_v1.sql` | 回滚草案 |
| `ddl/local_sqlite_v1.sql` | 客户端 SQLite schema 草案 |
| `openapi-v1.yaml` | V1 API 契约 |
| `EXPORT_FORMAT.md` | `.weavia` 导出/导入规范 |
| `export-manifest.schema.json` | manifest JSON Schema |
| `CAPABILITY_MATRIX.md` | 能力 → 供应商 → 模型 → 限制 |
| `PROVIDER_PROBE.md` | 2026-10-20 只读模型探测记录 |
| `ACCEPTANCE.md` | V1 验收用例 |
| `P1_STATUS.md` | P1a 进度与真实探测结果 |

## 待验证（进入 P1 前）

1. AntDigital 的 `qwen-image-*` / `wan2.7-image` 是否支持图片输入；`/v1/models` 的 capabilities 为 null，需真实请求探测。带商品图先走 DashScope。
2. DashScope 北京地域 Workspace/API Key、`wanx2.1-imageedit` 开通与并发配额。
3. 10GB/30 天存储包的定价与到期策略。
4. 最小后台范围：邀请码、用户、Credits、存储包、任务、模型。
5. F03 的 Credits 单价（免费 30 只覆盖一次基础文生图；F03 建议 40–50 Credits/张）。

## 下一步（P1）

- 将 DDL 转成 Drizzle migration 并接入 journal。
- 按 OpenAPI 生成后端 handler/类型。
- 客户端 SQLite 迁移与 `.weavia` 导入导出。
