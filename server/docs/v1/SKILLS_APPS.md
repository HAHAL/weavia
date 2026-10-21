# Skill / AI 应用（阶段 1）

## 已完成

- 左侧导航收敛为：工作台 / Skill / AI 应用 / 作品 / 素材。
- 移除搜索、创作、商品一级入口。
- Skill 数据表、版本表、AI 应用数据表。
- 12 个种子 Skill（提示词型）。
- 8 个种子应用：6 个图片应用发布，2 个视频应用草稿。
- 首页 Agent 模式：选择 Skill、填输入、选模型、生成。
- Skill 库：公开 Skill、我的 Skill、上传私有 Skill。
- AI 应用：点击应用、填写字段、直接生成图片。
- 后台 AI Studio 新增 Skill 管理、AI 应用管理。
- 客户上传 Skill 默认私有、pending，管理员发布后公开。
- 图片应用/Agent 已接真实任务、Credits、作品保存。

## 未完成（按阶段）

- 阶段 2：代码 Skill 的 WASM/JavaScript 沙箱、上传代码、试运行、审核。
- 阶段 3：AntDigital 视频接入、视频应用、视频输入素材。
- AI 应用的图片素材替换依赖 F02 参考图链路。
- 应用创建/编辑器目前仅支持状态管理，完整表单编辑后续补。

## 接口

- `GET /api/skills`
- `GET /api/my/skills`
- `POST /api/skills`
- `POST /api/skills/{id}/runs`
- `GET /api/apps`
- `POST /api/apps/{id}/runs`
- `GET /api/admin/skills`
- `PATCH /api/admin/skills/{id}`
- `GET /api/admin/apps`
- `PATCH /api/admin/apps/{id}`
