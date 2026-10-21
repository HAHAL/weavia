# 运营后台（Admin Console）

## 定位

独立 Web 后台，连接新 Go API，不再使用旧 `zhiweiProject/apps/admin` 的蓝色 Next.js 壳。

代码：`apps/admin`，金色/奶油风格，零构建静态 SPA。

## 页面

| 页面 | 数据 |
| --- | --- |
| 仪表盘 | `/api/admin/overview`、订单、任务、内容数量 |
| 用户中心 | `/api/admin/users`；状态启停、Credits 调整 |
| 商业中心 | 套餐、订单、支付；套餐价格/启用状态编辑 |
| AI Studio | Provider、平台模型、路由、用量；Provider 启停、Key 设置 |
| 创作任务 | `/api/admin/tasks`、`/api/admin/task-runs` |
| 内容管理 | `/api/admin/showcase` 上传/发布/排序/删除 |
| 数据分析 | 收入、AI 成本、任务、Provider 用量 |
| 设置 | API 地址、管理员信息、服务健康 |

## Provider Key

后台可加密保存 `antdigital` / `dashscope` Key；Key 只回显末四位。详见 `PROVIDER_MODELS.md`。

## 登录与权限

- 登录：`POST /api/auth/login`，Bearer Token 存 `sessionStorage`
- 页面数据：`/api/admin/*`，需要 `admin.read`
- 写操作：`credits.write`、`users.write`、`plans.write`、`provider.write`、`showcase.write`
- 开发账号由 `cmd/seed` 设为 `super_admin`

## 部署

```bash
docker compose up -d --build admin
```

生产 Caddy：

```caddy
@admin path /admin /admin/*
handle @admin {
    uri strip_prefix /admin
    reverse_proxy admin:80
}
```

本地/测试隧道：

```bash
ssh -N -L 3001:127.0.0.1:3001 root@<server>
```

打开 `http://127.0.0.1:3001`。

## 尚未做

- 后台内的 AI 生成示例图按钮（先上传）
- 更细的审计日志页面
- 角色/权限管理页面
