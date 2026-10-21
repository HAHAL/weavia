# 示例图库（Showcase）

客户端首页的「灵感示例」和「示例作品」由统一 Web 运营后台上传，客户端通过公开 API 动态读取；本地 `public/showcase` 只作为离线兜底。后台包含用户、商业、AI、任务、内容与数据分析。

## 数据

`showcase_items`（迁移 `0009_showcase_library.sql`）：

| 字段 | 说明 |
| --- | --- |
| `kind` | `image` 示例图 / `work` 示例作品 |
| `title` / `tag` / `prompt` | 客户端展示与点击回填 |
| `image_key` / `image_mime` | 服务端存储位置与类型 |
| `status` | `draft` / `published` |
| `sort_order` | 排序 |
| `created_by` | 管理员 |

图片存储在 `ASSET_STORAGE_DIR/showcase/`，Docker 使用 `weavia-assets` volume。

## API

公开：

```text
GET /api/showcase                         # 已发布内容
GET /api/showcase/images/{id}             # 图片
```

管理（需 `admin.read` / `showcase.write`）：

```text
GET    /api/admin/showcase
POST   /api/admin/showcase                # multipart: image, kind, title, tag, prompt, status, sortOrder
PATCH  /api/admin/showcase/{id}           # kind,title,tag,prompt,status,sortOrder
DELETE /api/admin/showcase/{id}
```

上传限制：JPEG / PNG / WebP，最大 10MB。

## Web 管理后台

代码：`apps/admin`，统一运营后台；设计说明见 `docs/v1/ADMIN.md`。

本地：

```bash
python3 -m http.server 3001 --bind 127.0.0.1 --directory apps/admin
```

Docker：

```bash
docker compose up -d --build admin
```

测试服务器通过 SSH 隧道：

```bash
ssh -N -L 3001:127.0.0.1:3001 root@<server>
```

打开 `http://127.0.0.1:3001`，使用开发管理员账号登录。生产 Caddy 将 `/admin` 反代到 `admin:80`。

## 角色

`0009` 增加 `showcase.write`，并授予 `super_admin` / `operator`；`cmd/seed` 会把开发账号设为 `super_admin`。

## 客户端

`src/services/showcase.ts` 调用 `/api/showcase`，图片 URL 转为 API 绝对地址；失败或空列表时回退到 `src/data/showcase.ts` 的本地 6 张图。

## 尚未做

后台的「AI 生成示例图」按钮尚未接入；当前先支持上传。后续复用现有 Provider/Router，生成结果落库后直接发布。
