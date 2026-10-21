# WEAVIA 运营管理后台

独立 Web 后台，金色/奶油视觉，统一管理：

- 仪表盘
- 用户中心（状态、Credits 调整）
- 商业中心（套餐、订单、支付）
- AI Studio（Provider、模型、路由、用量）
- 创作任务（任务、执行记录）
- 内容管理（示例图 / 示例作品上传、发布、排序、删除）
- 数据分析
- 设置

## 本地

```bash
python3 -m http.server 3001 --bind 127.0.0.1 --directory apps/admin
```

打开 http://127.0.0.1:3001 ，API 默认 `http://127.0.0.1:8080`。

## Docker

```bash
docker compose up -d --build admin
```

打开 http://127.0.0.1:3001 。

## 生产

Caddy 将 `/admin` 反代到 `admin:80`；API 同源 `/api`。登录统一走 Go API `/api/auth/login`。
