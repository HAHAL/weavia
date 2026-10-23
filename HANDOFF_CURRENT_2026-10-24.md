# WEAVIA 交接文档（2026-10-24）

给接手的工具/人。本文以当前代码、线上实例和本轮验证为准；日期更早的 `HANDOFF_CURRENT_2026-10-23.md` 与 `HANDOFF.md` 部分内容已过时。

## 0. 一句话现状

服务端已从 `6b6d531` 迭代到 `66c0a48` 并部署在 `8.160.190.182`；图片主链路、邀请码、OSS 存储、多 Key、渠道分组、路由编辑、定价与毛利、审计、角色管理都已落地。**视频（字节 Seedance）只完成了适配器与模型接入，没有跑过真实生成**。

## 1. 仓库与提交

- 仓库：`/Users/jiangliu/Documents/weavia`（client + server 单仓）
- 分支：`feat/server-client-monorepo`
- HEAD：`66c0a48`，已推送 `origin/feat/server-client-monorepo`
- `main` 仍停在 `7700087`，**未合并**
- 未提交：`HANDOFF.md`（已修改）、`HANDOFF_CURRENT_2026-10-23.md`、`client/docs/product/WEAVIA_CREATIVE_PARITY_PRD_V2.md`

本轮提交（旧→新）：

```
0be6297 路由绑定可编辑（优先级/权重/启停）
967a66e 管理端写操作审计 + 设置页展示
c6a645e 渠道模型清单、分组价格倍率、修复账户键上传校验
2eea962 存储迁移（本地↔OSS）、读穿透、写降级
989804e 后台易用性：分页/排序/CSV、角色管理、审计扩展、定价分组、渠道编辑、邀请码批量
66c0a48 独立「角色权限」页 + 后台 BUILD_TAG
```

## 2. 运行环境

| 项 | 值 |
| --- | --- |
| 服务器 | `8.160.190.182`（阿里云，2 vCPU / 2 GiB / 40 GB） |
| SSH | `root@8.160.190.182`，密钥在本机 `~/Documents/deepseek-harness/default-workspace/.ssh/id_ed25519_ecs`（**不要复制进仓库**） |
| 部署目录 | `/opt/weavia-v2`（**不是 git 仓库**，是从本地打包上传的代码目录） |
| Compose 项目 | `weavia-v2`（容器名 `weavia-v2-{backend,worker,admin,postgres}-1`） |
| 端口 | API `0.0.0.0:8080`、后台 `0.0.0.0:3001`、Postgres 仅 `127.0.0.1:5432` |
| TLS | **没有**。域名在备案，当前纯 HTTP |
| 数据库 | 容器内 `weavia` 库，用户 `weavia` |
| 备份 | `/opt/backups/<时间戳>/`（含 pg_dump、assets 卷 tar、旧镜像 tag `pre-6b6d531`） |
| 后台版本标记 | 设置页显示 `BUILD_TAG`，当前 `2026-10-24-a`；不是这个值说明浏览器还在用旧包 |

**迁移不会自动执行**：`migrate` 命令只跑 River；Drizzle SQL（`server/packages/database/drizzle/*.sql`）需要手工 `psql -f`，或在全新库初始化时由 postgres initdb 自动执行。

## 3. 账号与密钥

- 管理员：`dev@weavia.local`（密码见旧 `HANDOFF.md`，**建议尽快轮换**），账户 ID `WA100001`
- 注册：**必须邀请码**（`INVITE_CODE_REQUIRED` 默认 true）
- 未使用邀请码：`PH3SWYQRV9`、`3243LBJH8M`、`FCZZYUG5TL`（各 1 次，2026-10-30 到期）
- 火山方舟 Key：已加密存入渠道「火山方舟 · 主账号」，末四位 `0efd`。**该 Key 曾出现在对话记录里，建议轮换**
- OSS AK：`LTAI5t8gqPgUT8Eubm8aPL7N`（Secret 加密存库，只回显末四位）
- 所有 Provider Key、AK/SK 都不在仓库里；不要提交、不要写进 `VITE_*`

## 4. 架构与已完成能力

### 4.1 服务端

- Go API + River Worker + PostgreSQL；`/api/admin/*` 走角色权限
- 生成链路：`generation` → `routingadapter` → `routing` → `providers`
- 计价：`pricing`（成本/毛利/汇率）、`commercial`（Credits 预扣/结算）
- 存储：`assets`（本地磁盘 + OSS + 读穿透 + 写降级）、`storageconfig`（配置/迁移）
- 注册：`invite`（原子占用/释放、来源绑定）

### 4.2 AI Studio（后台）

- 概览（渠道/用量/成本/告警）
- 供应商（按渠道聚合：渠道数、Key 数、失败数、文档链接）
- 渠道与 Key（多 Key、权重、冷却、发现模型、手动接入、模型清单、编辑/删除）
- 模型与能力、路由（可编辑优先级/权重/启停）、分组（倍率、渠道、账户绑定）、用量（搜索）
- 定价与成本（分组切换看实付与毛利、50% 红线拦截）

### 4.3 客户端

- 账号隔离：本机状态与素材按 `userId` 分区；旧 `weavia.state.v1` 首次登录归户
- 逐输出恢复：按 output index 记账，断网/重启只补缺失
- 邀请码注册、OSS 同步开关（后端按账户授权）、模型首字母图标、帮助与反馈入口
- 安装包：`/Users/jiangliu/Documents/WEAVIA-Desktop-0.1.0-macos-arm64.zip`
  SHA-256 `43ef1e888f7f155b148b16973c7f29616a77bb467f4c1e1b5f449db2c4746645`，**未签名公证**

## 5. 线上数据现状

| 项 | 值 |
| --- | --- |
| 用户 / 任务 / 素材 | 5 / 49 / 37 |
| 逻辑模型 | 38（含 Seedance 2.0 Fast、2.5） |
| 渠道 | 7（antdigital 4、dashscope 1、computrix 1、volcengine 1） |
| 渠道组 | `default`（6 渠道，倍率 1.0）、`premium`（1 渠道，倍率 1.0，绑定 WA100001） |
| 成本核实 | 10 条已核实（阿里云 ¥0.20/张）、95 条待核实 |
| 汇率 / 红线 | 1 Credit = ¥5、USD→CNY 7.1、最低毛利率 50% |
| OSS | `weavia001` @ `oss-cn-wulanchabu`，走内网 endpoint，客户端取用 `server` |
| 存储迁移 | 37 个对象 / 27.1 MB 已迁到 `WA100001/...`，幂等复跑通过 |

## 6. 验证边界（重要）

**实测通过**

- `/api/readiness` 三项 ok；登录、模型列表、管理员接口
- OSS：测试连接、真实上传（204）、迁移 dry-run/执行/复跑幂等
- 路由 PATCH 与审计落库（含 before/after）
- 角色列表、邀请码批量生成、定价分组返回

**没有验证**

- 后台 UI 的视觉与交互：分页/排序/CSV、角色页、定价分组下拉、渠道编辑，只做了 `node --check` 与部署
- 读穿透（切回 local 后读 OSS）与写降级（OSS 故障落本地）：只走了代码路径，没有故障注入
- 视频生成：**一次真实调用都没有**（遵守“不发起付费视频任务”）
- 客户端 UI 流程：换账号隔离、4 张断网补齐等，均未人工点检

## 7. 已知问题 / 未完成

| 级别 | 项 |
| --- | --- |
| P0 | 后台新增 UI 未点检，可能存在交互问题（先看设置页 BUILD_TAG 判断是否旧包） |
| P0 | 服务端 HTTP + 真实 AI 开启，8080/3001 对公网开放，建议限源或等备案上 HTTPS |
| P1 | 告警只有页面展示，没有飞书/邮件推送 |
| P1 | 没有对账报表（收入/成本/毛利趋势） |
| P1 | 任务重试/取消/退款在后台不可用 |
| P1 | 客户端 CDN 模式只存配置，URL 改写未实现；`sync_showcase` 只有开关 |
| P1 | 迁移是同步请求，数据量大时会超时 |
| P2 | Key 无 RPM/日额度；模型目录不能改名/下线；邀请码无使用明细 |
| P2 | Seedance 成本按秒未核实，售价 50 Credits 是占位 |
| P2 | Computrix 渠道连续失败 6 次仍未处理 |

## 8. 不要做的事

- 不要把 DAG 执行迁到服务端（产品已决定 DAG 永远在客户端）
- 不要在未确认预算时发起付费视频/图片生成；视频尤其贵
- 不要把任何 Key 写进仓库、日志、`VITE_*`
- 不要用 HTTP 地址当生产地址；域名备案完成前不要对外宣称生产可用
- 不要删除 `/opt/weavia-v2` 以外的备份目录；回滚镜像 tag 是 `pre-6b6d531`

## 9. 建议的接手顺序

1. **人工点检后台**（设置页确认 `2026-10-24-a`）：角色页、分页/排序、定价分组、渠道编辑
2. **跑通一条真实视频**（Seedance 2.0 Fast，3–5 秒，需确认预算），验证异步轮询、按秒结算、结果下载
3. **告警推送**（渠道失败、余额、存储），补可观测性
4. **任务重试/取消**（客服场景，与客户端帮助入口配套）
5. **对账报表**（按日收入 vs 成本 vs 毛利，验证分组倍率效果）
6. **客户端 CDN 模式生效 + 展示数据同步**（若要做跨设备/多机）
7. 域名备案后：HTTPS、反向代理真实 IP、收紧安全组

## 10. 常用命令

```bash
# 连接
ssh -i ~/Documents/deepseek-harness/default-workspace/.ssh/id_ed25519_ecs root@8.160.190.182

# 状态与日志
cd /opt/weavia-v2 && docker compose ps
docker logs --tail 100 weavia-v2-backend-1

# 手工迁移（Drizzle SQL 不会自动跑）
docker exec -i weavia-v2-postgres-1 psql -U weavia -d weavia -v ON_ERROR_STOP=1 < packages/database/drizzle/00XX_xxx.sql

# 发版（当前流程，无 CI）
# 1) 本地交叉编译 linux/amd64 → tar
# 2) scp 到 /tmp
# 3) 服务器上用现有镜像作底座：FROM weavia-v2-backend:latest + COPY 二进制
# 4) docker tag ... latest；docker compose up -d --no-build --no-deps backend worker admin

# 备份
TS=$(date +%Y%m%d-%H%M%S); mkdir -p /opt/backups/$TS
docker exec weavia-v2-postgres-1 pg_dump -U weavia -d weavia -Fc > /opt/backups/$TS/weavia.dump
```

## 11. 关键文件

服务端：

- `server/services/backend/internal/routing/service.go`（路由/分组/发现模型/健康）
- `server/services/backend/internal/generation/service.go`（计价、结算、输出保存）
- `server/services/backend/internal/pricing/`、`commercial/`、`invite/`、`storageconfig/`
- `server/services/backend/internal/assets/`（磁盘、OSS、读穿透、写降级）
- `server/services/backend/internal/httpapi/`（所有后台接口）
- `server/apps/admin/app.js`（后台单页，约 1000 行）
- `server/packages/database/drizzle/00*.sql`（0015–0025 为本轮新增）

客户端：

- `client/src/stores/{app,auth,scope,account}.ts`（账号隔离）
- `client/src/services/live.ts`、`client/src/lib/outputs.ts`（逐输出恢复）
- `client/src/pages/{Home,System,Register,Tasks}.tsx`
- `client/src-tauri/src/codex.rs`（内嵌 Codex，Key 存系统钥匙串，服务端不下发）

## 12. 凭据与口径提醒

- 内嵌 Codex：引擎不随包分发，需用户导入；网关 Key 由用户在客户端填写、存钥匙串，**服务端没有下发或代理**
- 模型计费口径：`最终售价 = 逻辑模型 Credits × 账户分组倍率`；渠道成本只用于毛利与拦截
- 结算口径：成功任务按实际交付张数结算，视频渠道按提交数量结算（`channel_models.billing_basis`）
