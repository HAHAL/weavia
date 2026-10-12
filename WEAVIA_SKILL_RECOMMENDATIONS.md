# WEAVIA Skill 配置建议报告

审计日期：2026-10-12。以下是能力配置建议，**未安装任何 Skill**。先用仓库规范和 CI 固化共性规则；Skill 是可复用工作流，不替代代码审查、测试或生产验收。选型以实际可维护的 Skill 内容、工具权限和团队使用频率为准，不假设某个同名 Skill 已存在。

| 推荐 Skill | 是否需要 / 优先级 | 使用场景 | 安装顺序 |
| --- | --- | --- | --- |
| Git/GitHub Engineering | 需要 / P0 | 分支/PR、变更范围、冲突处理、提交与 CI 状态检查；保护当前未提交工作。 | 1 |
| Code Review | 需要 / P0 | 重点审查身份、权限、Credits、任务幂等、资产与迁移，输出可定位问题。 | 2 |
| Testing Automation | 需要 / P0 | 按影响选择 Go/TS/Rust/PG 测试，生成可追溯验证报告；建立商业 E2E。 | 3 |
| Security Audit | 需要 / P0 | Token、RBAC、密钥、支付回调、素材上传/SSRF 与依赖检查。 | 4 |
| Backend Architecture | 需要 / P1 | Go API/Worker、PostgreSQL/River、事务边界和多租户演进设计。 | 5 |
| AI Provider Integration | 需要 / P1 | 供应商契约、模型能力、错误分类、成本与真实小额验收；Key 必须留服务端。 | 6 |
| DevOps Deployment | 需要 / P1 | 备份迁移、单机资产限制、健康检查、预生产/生产发布和桌面签名。 | 7 |
| Frontend Design System | 建议 / P2 | Web/Admin/Desktop 共享视觉令牌、组件一致性、可访问性；以 `packages/ui` 为基础。 | 8 |

建议先检查现有工具/Skill 是否已有同等能力，再安装或编写项目专用 Skill；每个 Skill 都应引用 `.ai/` 规则，明确只读/写入权限、触发条件和输出格式。安装前先验证来源、维护状态及所需外部权限。当前阶段无安装动作。
