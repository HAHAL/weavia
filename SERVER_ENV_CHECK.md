# 织维 staging 服务器环境检查

检查时间：2026-10-11（Asia/Shanghai）  
目标：`root@47.113.148.107`，仅用于 staging。

| 项目 | 结果 |
| --- | --- |
| OS | Ubuntu 24.04.5 LTS，x86_64 |
| CPU | 4 vCPU，AMD EPYC |
| 内存 | 7.4 GiB，总可用约 6.8 GiB；无 Swap |
| 磁盘 | 根分区 59 GiB，约 54 GiB 可用 |
| Docker / Compose | 初检均未安装，需安装 |
| Git / curl | `git 2.43.0`、`curl 8.5.0` 已安装 |
| 网络 | Ubuntu apt 源、GHCR、npm 镜像、Go 代理 HTTPS 可达；Docker Hub `registry-1.docker.io:443` 初检连接失败 |
| 监听端口 | 初检仅 SSH 22 对外监听；UFW inactive |
| 部署目录 | `/opt/zhiwei` 初检不存在 |

注意：当前 `docker-compose.yml` 仅定义 PostgreSQL、迁移、Backend、Worker，未定义 Web/Admin；且镜像拉取需解决 Docker Hub 出口问题。请勿把真实生产密钥或本地 `.env` 同步至服务器。服务器 root 密码曾通过聊天提供，演练后应轮换，并改为密钥登录。
