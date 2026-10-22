# WEAVIA 客户端 Codex 接入

## 当前可用范围

- 在「账户与设置 → AI 助手服务」配置模型网关地址、模型 ID 和服务 Key。
- 网关须支持 OpenAI Responses API。远程地址使用 HTTPS；本机 `localhost` 可用 HTTP。
- 在「视频工作台 → AI 分镜策划」输入商品和运营需求，生成可编辑的分镜草案。
- 视频工作台的「提交演示任务」仍为 Mock，不会调用视频生成 Provider。

## 引擎和本机环境

客户端通过 Codex app-server 的 stdio 协议运行独立进程。开发版若未打包引擎，可在设置页导入可信来源的 Codex CLI 执行程序；导入会先复制，再验证版本。正式发布包应随应用分发经过验证的对应平台引擎。

WEAVIA 使用应用专属目录作为 `CODEX_HOME`、`CODEX_SQLITE_HOME` 和工作目录，不读取或修改设备上已有 Codex 的配置、登录信息、会话。服务 Key 保存在系统钥匙串；配置文件仅保存地址和模型。进程使用只读沙箱，并阻止将父进程环境变量传给 Codex 工具执行环境。

## 使用步骤

1. 如页面提示缺少引擎，导入可信来源的 `codex` 执行程序。macOS 上可在 Codex/ChatGPT 应用包内容中找到 CLI；导入的是副本。
2. 填写网关的 `/v1` 基础地址、支持 Responses API 的模型 ID 和个人服务 Key，保存。
3. 可点「测试连接」发送一条简短请求。该操作会实际调用模型，可能产生费用。
4. 打开视频工作台，填写视频需求并点「生成分镜草案」。检查商品事实、文案和时长后再用于后续工作。

## 发布前注意

- 网关 Key 应为可撤销、可限额的用户级凭证。平台主密钥应留在服务端，不应发给桌面客户端。
- 需要针对实际目标网关做一次端到端联调，确认其 Responses API 与所选 Codex 版本兼容。
- 视频 Provider 尚未接入；分镜生成不会生成最终视频。

协议参考：[Codex App Server](https://learn.chatgpt.com/docs/app-server)、[Codex 自定义模型提供方](https://learn.chatgpt.com/docs/config-file/config-advanced)。
