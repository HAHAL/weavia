use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use url::Url;

const KEY_SERVICE: &str = "com.weavia.desktop.codex";
const KEY_ACCOUNT: &str = "gateway";
const KEY_ENV: &str = "WEAVIA_CODEX_GATEWAY_KEY";

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexSettings {
    pub base_url: String,
    pub model: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStatus {
    pub base_url: String,
    pub model: String,
    pub key_configured: bool,
    pub engine_available: bool,
}

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_dir(app)?.join("codex").join("gateway.json"))
}

fn key_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEY_SERVICE, KEY_ACCOUNT)
        .map_err(|error| format!("无法访问系统钥匙串：{error}"))
}

fn read_key() -> Result<Option<String>, String> {
    match key_entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("无法读取 Codex 服务密钥：{error}")),
    }
}

fn read_settings(app: &AppHandle) -> Result<CodexSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(CodexSettings::default());
    }
    let data = fs::read(&path).map_err(|error| format!("无法读取 Codex 配置：{error}"))?;
    serde_json::from_slice(&data).map_err(|error| format!("Codex 配置无效：{error}"))
}

fn engine_path(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join("codex"));
        candidates.push(resources.join("bin").join("codex"));
    }
    if let Ok(data) = app_dir(app) {
        candidates.push(data.join("bin").join("codex"));
    }
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("WEAVIA_CODEX_BIN") {
        candidates.insert(0, PathBuf::from(path));
    }
    candidates.into_iter().find(|path| path.is_file())
}

#[tauri::command]
pub fn codex_status(app: AppHandle) -> Result<CodexStatus, String> {
    let settings = read_settings(&app)?;
    Ok(CodexStatus {
        base_url: settings.base_url,
        model: settings.model,
        key_configured: read_key()?.is_some(),
        engine_available: engine_path(&app).is_some(),
    })
}

#[tauri::command]
pub fn codex_save_settings(
    app: AppHandle,
    base_url: String,
    model: String,
    key: Option<String>,
) -> Result<CodexStatus, String> {
    let base_url = base_url.trim().trim_end_matches('/').to_owned();
    let model = model.trim().to_owned();
    let parsed = Url::parse(&base_url).map_err(|_| "请输入完整的模型服务地址".to_owned())?;
    let local = matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if parsed.scheme() != "https" && !(parsed.scheme() == "http" && local) {
        return Err("远程模型服务必须使用 HTTPS；本机 localhost 可使用 HTTP".into());
    }
    if parsed.username() != ""
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("服务地址不能包含账号、密码或查询参数".into());
    }
    if model.is_empty() || model.len() > 128 {
        return Err("请输入有效的模型名称".into());
    }
    let path = settings_path(&app)?;
    fs::create_dir_all(path.parent().ok_or("配置目录无效")?)
        .map_err(|error| format!("无法创建 Codex 配置目录：{error}"))?;
    if let Some(value) = key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        key_entry()?
            .set_password(value)
            .map_err(|error| format!("无法保存服务密钥：{error}"))?;
    }
    let data = serde_json::to_vec_pretty(&CodexSettings { base_url, model })
        .map_err(|error| format!("无法编码 Codex 配置：{error}"))?;
    fs::write(path, data).map_err(|error| format!("无法保存 Codex 配置：{error}"))?;
    codex_status(app)
}

#[tauri::command]
pub fn codex_clear_key(app: AppHandle) -> Result<CodexStatus, String> {
    match key_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => codex_status(app),
        Err(error) => Err(format!("无法删除服务密钥：{error}")),
    }
}

fn import_engine(app: AppHandle, source: String) -> Result<CodexStatus, String> {
    let source = fs::canonicalize(source).map_err(|error| format!("无法读取执行程序：{error}"))?;
    let metadata = fs::metadata(&source).map_err(|error| format!("无法检查执行程序：{error}"))?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > 600 * 1024 * 1024 {
        return Err("请选择有效的 Codex 执行程序".into());
    }
    let directory = app_dir(&app)?.join("bin");
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建引擎目录：{error}"))?;
    let destination = directory.join("codex");
    let temporary = directory.join("codex.importing");
    let result = (|| {
        fs::copy(&source, &temporary)
            .map_err(|error| format!("无法复制 Codex 执行程序：{error}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&temporary, fs::Permissions::from_mode(0o700))
                .map_err(|error| format!("无法设置执行权限：{error}"))?;
        }
        let probe_home = app_dir(&app)?.join("codex").join("engine-probe");
        fs::create_dir_all(&probe_home).map_err(|error| format!("无法验证执行程序：{error}"))?;
        let mut probe = Command::new(&temporary)
            .arg("--version")
            .env("CODEX_HOME", &probe_home)
            .env("CODEX_SQLITE_HOME", &probe_home)
            .env_remove("OPENAI_API_KEY")
            .env_remove("CODEX_API_KEY")
            .env_remove("CODEX_ACCESS_TOKEN")
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Codex 执行程序无法启动：{error}"))?;
        let deadline = Instant::now() + Duration::from_secs(30);
        let success = loop {
            if let Some(status) = probe
                .try_wait()
                .map_err(|error| format!("验证执行程序失败：{error}"))?
            {
                break status.success();
            }
            if Instant::now() >= deadline {
                let _ = probe.kill();
                let _ = probe.wait();
                return Err("Codex 执行程序验证超时".into());
            }
            std::thread::sleep(Duration::from_millis(50));
        };
        let mut version = String::new();
        if let Some(mut stdout) = probe.stdout.take() {
            stdout
                .read_to_string(&mut version)
                .map_err(|error| format!("无法读取 Codex 版本：{error}"))?;
        }
        if !success || !version.trim().starts_with("codex-cli ") {
            return Err("所选文件不是可用的 Codex CLI 执行程序".into());
        }
        #[cfg(windows)]
        if destination.exists() {
            fs::remove_file(&destination)
                .map_err(|error| format!("无法替换旧 Codex 执行程序：{error}"))?;
        }
        fs::rename(&temporary, destination)
            .map_err(|error| format!("无法安装 Codex 执行程序：{error}"))?;
        codex_status(app)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[tauri::command]
pub async fn codex_import_engine(app: AppHandle, source: String) -> Result<CodexStatus, String> {
    tauri::async_runtime::spawn_blocking(move || import_engine(app, source))
        .await
        .map_err(|error| format!("Codex 执行程序导入失败：{error}"))?
}

struct ChildGuard(Child);

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn send(stdin: &mut ChildStdin, id: u64, method: &str, params: Value) -> Result<(), String> {
    let message = json!({ "id": id, "method": method, "params": params });
    writeln!(stdin, "{message}").map_err(|error| format!("Codex 通信失败：{error}"))?;
    stdin
        .flush()
        .map_err(|error| format!("Codex 通信失败：{error}"))
}

fn next_message(receiver: &Receiver<Value>, deadline: Instant) -> Result<Value, String> {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return Err("Codex 响应超时".into());
    }
    receiver
        .recv_timeout(remaining)
        .map_err(|_| "Codex 已退出或响应超时".to_owned())
}

fn response(receiver: &Receiver<Value>, id: u64, timeout: Duration) -> Result<Value, String> {
    let deadline = Instant::now() + timeout;
    loop {
        let message = next_message(receiver, deadline)?;
        if message.get("id").and_then(Value::as_u64) != Some(id) {
            continue;
        }
        if let Some(error) = message.get("error") {
            return Err(format!(
                "Codex 请求失败：{}",
                error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("未知错误")
            ));
        }
        return message
            .get("result")
            .cloned()
            .ok_or("Codex 返回的数据不完整".into());
    }
}

fn run_prompt(app: AppHandle, prompt: String) -> Result<String, String> {
    let settings = read_settings(&app)?;
    if settings.base_url.is_empty() || settings.model.is_empty() {
        return Err("请先在账户与设置中配置 AI 助手服务".into());
    }
    let key = read_key()?.ok_or("请先配置 AI 助手服务 Key")?;
    let binary = engine_path(&app).ok_or("WEAVIA 专用 Codex 执行程序尚未安装")?;
    let codex_home = app_dir(&app)?.join("codex").join("home");
    let workspace = app_dir(&app)?.join("codex").join("workspace");
    fs::create_dir_all(&codex_home).map_err(|error| format!("无法创建 Codex 工作目录：{error}"))?;
    fs::create_dir_all(&workspace).map_err(|error| format!("无法创建 Codex 工作目录：{error}"))?;

    let mut child = ChildGuard(
        Command::new(binary)
            .args(["app-server", "--listen", "stdio://"])
            .arg("-c")
            .arg("model_provider=weavia_gateway")
            .arg("-c")
            .arg("model_providers.weavia_gateway.name=\"WEAVIA Gateway\"")
            .arg("-c")
            .arg(format!(
                "model_providers.weavia_gateway.base_url={}",
                serde_json::to_string(&settings.base_url).map_err(|error| error.to_string())?
            ))
            .arg("-c")
            .arg("model_providers.weavia_gateway.wire_api=\"responses\"")
            .arg("-c")
            .arg(format!(
                "model_providers.weavia_gateway.env_key=\"{KEY_ENV}\""
            ))
            .arg("-c")
            .arg("model_providers.weavia_gateway.requires_openai_auth=false")
            .arg("-c")
            .arg("model_providers.weavia_gateway.supports_websockets=false")
            .arg("-c")
            .arg("shell_environment_policy.inherit=\"none\"")
            .arg("-c")
            .arg("shell_environment_policy.ignore_default_excludes=false")
            .arg("-c")
            .arg("sandbox_mode=\"read-only\"")
            .env("CODEX_HOME", &codex_home)
            .env("CODEX_SQLITE_HOME", &codex_home)
            .env(KEY_ENV, key)
            .env_remove("OPENAI_API_KEY")
            .env_remove("CODEX_API_KEY")
            .env_remove("CODEX_ACCESS_TOKEN")
            .current_dir(&workspace)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("无法启动 WEAVIA Codex：{error}"))?,
    );
    let mut stdin = child.0.stdin.take().ok_or("无法连接 Codex 输入流")?;
    let stdout = child.0.stdout.take().ok_or("无法连接 Codex 输出流")?;
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            if let Ok(message) = serde_json::from_str::<Value>(&line) {
                if sender.send(message).is_err() {
                    break;
                }
            }
        }
    });

    send(
        &mut stdin,
        1,
        "initialize",
        json!({
            "clientInfo": { "name": "weavia_desktop", "title": "WEAVIA Desktop", "version": "0.1.0" }
        }),
    )?;
    response(&receiver, 1, Duration::from_secs(15))?;
    writeln!(stdin, "{}", json!({"method":"initialized","params":{}}))
        .map_err(|error| format!("Codex 初始化失败：{error}"))?;
    send(
        &mut stdin,
        2,
        "thread/start",
        json!({
            "model": settings.model,
            "cwd": workspace.to_string_lossy(),
            "approvalPolicy": "never",
        }),
    )?;
    let started = response(&receiver, 2, Duration::from_secs(20))?;
    let thread_id = started
        .pointer("/thread/id")
        .and_then(Value::as_str)
        .ok_or("Codex 未返回会话 ID")?;
    send(
        &mut stdin,
        3,
        "turn/start",
        json!({
            "threadId": thread_id,
            "input": [{"type":"text","text":prompt}]
        }),
    )?;

    let deadline = Instant::now() + Duration::from_secs(180);
    let mut reply = String::new();
    loop {
        let message = next_message(&receiver, deadline)?;
        if message.get("id").and_then(Value::as_u64) == Some(3) {
            if let Some(error) = message.get("error") {
                return Err(format!(
                    "Codex 请求失败：{}",
                    error
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("未知错误")
                ));
            }
        }
        match message.get("method").and_then(Value::as_str) {
            Some("item/agentMessage/delta") => {
                if let Some(delta) = message.pointer("/params/delta").and_then(Value::as_str) {
                    reply.push_str(delta);
                }
            }
            Some("turn/completed") => {
                let status = message
                    .pointer("/params/turn/status")
                    .and_then(Value::as_str)
                    .unwrap_or("failed");
                if status != "completed" {
                    return Err(format!("Codex 未完成本次请求：{status}"));
                }
                return if reply.trim().is_empty() {
                    Err("Codex 没有返回内容".into())
                } else {
                    Ok(reply)
                };
            }
            _ => {}
        }
    }
}

#[tauri::command]
pub async fn codex_test_connection(app: AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_prompt(app, "请只回复：连接成功。不要调用工具。".into())
    })
    .await
    .map_err(|error| format!("Codex 执行失败：{error}"))?
}

#[tauri::command]
pub async fn codex_plan_video(app: AppHandle, brief: String) -> Result<String, String> {
    let brief = brief.trim().to_owned();
    if brief.is_empty() || brief.len() > 4000 {
        return Err("请填写 1 到 4000 字的视频需求".into());
    }
    let prompt = format!(
        "你是电商短视频策划助手。根据下面的运营需求，输出一个严格 JSON 对象，不要 Markdown。格式为 {{\"shots\":[{{\"title\":\"镜头名称\",\"prompt\":\"画面与字幕描述\",\"duration\":5}}]}}。生成 3 到 5 个镜头，每个 duration 只能为 3、5 或 10 秒。只使用需求中明确给出的商品事实，不编造功效、认证、价格或承诺。不要调用工具，也不要生成视频。\n\n运营需求：\n{brief}"
    );
    tauri::async_runtime::spawn_blocking(move || run_prompt(app, prompt))
        .await
        .map_err(|error| format!("Codex 执行失败：{error}"))?
}
