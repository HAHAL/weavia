# WEAVIA 运行与排障部署说明

这批代码从 `codex/admin-ops-first-batch` 开始，包含尚未部署的 T1–T3 后台修复。部署时先比较线上代码与该分支，备份数据库和现有容器镜像，再更新。

## 手工迁移

`migrate` 只管理 River 迁移。新增的 Drizzle SQL 必须在启动新 API 与 Worker 前手工执行：

```sh
docker exec weavia-v2-postgres-1 pg_dump -U weavia -d weavia -Fc > /opt/backups/weavia-before-ops.dump
cd /opt/weavia-v2
docker exec -i weavia-v2-postgres-1 psql -U weavia -d weavia -v ON_ERROR_STOP=1 < packages/database/drizzle/0026_ops_observability.sql
```

先检查备份文件非空，并按交接文档的现行发版步骤准备镜像回滚点。迁移只创建新表及 `ops.read` 权限，不删除旧数据。历史任务不会凭空出现阶段时间线。

## 轻量宿主机采集器

采集器在宿主机通过 systemd timer 每分钟运行一次，读取 `/proc`、磁盘与 WEAVIA 的四个容器；每 5 分钟保留一条资源采样，7 天内明细，30 天内每小时采样。它只向 `var/ops` 写入安全摘要。后台 API 将该目录只读挂载，不接触 Docker socket。

```sh
install -d -m 755 /opt/weavia-v2/var/ops
install -m 644 /opt/weavia-v2/deploy/ops/weavia-ops-collect.service /etc/systemd/system/
install -m 644 /opt/weavia-v2/deploy/ops/weavia-ops-collect.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now weavia-ops-collect.timer
systemctl start weavia-ops-collect.service
systemctl status weavia-ops-collect.service --no-pager
```

默认容器名前缀为 `weavia-v2`。若 Compose 项目名不同，为采集服务设置 `WEAVIA_COMPOSE_PROJECT` 后重启 timer。`snapshot.json` 无敏感字段；容器日志只输出固定消息与任务 ID，原始日志仍需通过 SSH 查看。

## 验收与回退

1. 确认 `worker_heartbeats.last_seen_at` 在 90 秒内更新，后台显示 Worker 正常。
2. 确认 `var/ops/snapshot.json` 每分钟更新；后台能看到四个容器，CPU、内存和磁盘指标有采集时间。
3. 用已有任务检查渠道和 Credits 流水；新任务完成后应有阶段事件及 `task_runs` 记录。不要仅为验收触发付费生成。
4. 查看后台安全日志摘要，确认不包含 API Key、提示词和上游响应内容。
5. 检查 Docker `local` 日志驱动已应用于重建后的容器，每个容器轮转配置为 `10m × 3`。

若新版本异常，回滚容器镜像及后台静态资源，停止采集 timer；新增表可以保留，避免删除已采集的事件。若采集器故障，页面应将主机状态显示为“未知”，不应误报“正常”。
