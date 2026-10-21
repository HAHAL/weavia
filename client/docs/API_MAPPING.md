# 页面与接口映射

| 页面 / 功能 | 当前数据源 | 未来接口 | 当前状态 |
| --- | --- | --- | --- |
| Dashboard 模型选择 | `src/types` 演示目录 | GET `/models` | MOCKED |
| Dashboard Skill 选择 | `src/types` 演示目录 | GET `/skills` | MOCKED |
| 创作提交 | 本地定时 Mock | POST `/generations/images` / `/generations/videos` | MOCKED |
| Image Editing | 本地 Canvas 调整与作品版本 | 图像编辑任务接口待提案 | 本地实现；AI 能力未接入 |
| Video Studio | 本地分镜与演示任务 | POST `/generations/videos` | MOCKED |
| 商品库 | Zustand + SQLite 快照 | `/products` | MOCKED |
| 素材中心 | Tauri 本地文件 + SQLite 路径/校验值；浏览器 data URL 回退 | `/assets` | 本地实现；云同步 PROPOSED |
| Skill Center | 本地目录和启用偏好 | `/skills` | MOCKED |
| Workflow Studio | React Flow + localStorage | `/workflows`, `/runs` | MOCKED |
| 任务中心 | 本地演示状态 | `/tasks` | MOCKED |
| 作品中心 | 本地占位版本 | `/works`, `/versions` | MOCKED |
| 账户 / 登录与安全 | 无真实账户 | `/auth/*`, `/me` | PROPOSED |
| 会员 / Credits / 订单 | 无真实交易数据 | `/subscription`, `/credits/*`, `/orders/*` | PROPOSED |
| 日志与诊断 | localStorage | POST `/client/diagnostics` | 本地实现；上传 PROPOSED |

所有远端路径仅是契约提案。没有读取现有 Go 服务文档或确认已实现接口。
