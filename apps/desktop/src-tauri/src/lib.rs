use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

mod local_data;
use local_data::{GeneratedResult, LocalAsset, LocalData, LocalDataInfo, LocalProject, LocalTask};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    platform: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceInfo {
    device_id: String,
    device_name: String,
    platform: &'static str,
    os_version: String,
    app_version: &'static str,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "WEAVIA",
        version: env!("CARGO_PKG_VERSION"),
        platform: std::env::consts::OS,
    }
}

fn token_entry(kind: &str) -> Result<keyring::Entry, String> {
    if kind != "access" && kind != "refresh" {
        return Err("invalid token kind".into());
    }
    keyring::Entry::new("com.weavia.desktop", kind).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_secure_token(kind: String) -> Result<Option<String>, String> {
    match token_entry(&kind)?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn set_secure_token(kind: String, token: String) -> Result<(), String> {
    token_entry(&kind)?
        .set_password(&token)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_secure_tokens() -> Result<(), String> {
    for kind in ["access", "refresh"] {
        match token_entry(kind)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(())
}

fn device_id_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("device-id"))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_device_info(app: AppHandle) -> Result<DeviceInfo, String> {
    let path = device_id_path(&app)?;
    let device_id = match fs::read_to_string(&path) {
        Ok(value) if !value.trim().is_empty() => value.trim().to_owned(),
        _ => {
            let value = uuid::Uuid::new_v4().to_string();
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::write(&path, &value).map_err(|error| error.to_string())?;
            value
        }
    };
    let device_name = std::env::var("HOSTNAME").unwrap_or_else(|_| "WEAVIA Desktop".into());
    Ok(DeviceInfo {
        device_id,
        device_name,
        platform: std::env::consts::OS,
        os_version: std::env::consts::OS.into(),
        app_version: env!("CARGO_PKG_VERSION"),
    })
}

#[tauri::command]
fn get_local_data_info(data: tauri::State<'_, LocalData>) -> Result<LocalDataInfo, String> {
    data.info()
}

#[tauri::command(rename_all = "camelCase")]
fn create_local_project(
    data: tauri::State<'_, LocalData>,
    name: String,
    description: String,
) -> Result<LocalProject, String> {
    data.create_project(&name, &description)
}

#[tauri::command]
fn list_local_projects(data: tauri::State<'_, LocalData>) -> Result<Vec<LocalProject>, String> {
    data.list_projects()
}

#[tauri::command(rename_all = "camelCase")]
fn get_local_project(
    data: tauri::State<'_, LocalData>,
    project_id: String,
) -> Result<Option<LocalProject>, String> {
    data.get_project(&project_id)
}

#[tauri::command(rename_all = "camelCase")]
fn open_local_project(
    data: tauri::State<'_, LocalData>,
    project_id: String,
) -> Result<LocalProject, String> {
    data.open_project(&project_id)
}

#[tauri::command(rename_all = "camelCase")]
fn update_local_project(
    data: tauri::State<'_, LocalData>,
    project_id: String,
    name: String,
    description: String,
) -> Result<LocalProject, String> {
    data.update_project(&project_id, &name, &description)
}

#[tauri::command(rename_all = "camelCase")]
fn delete_local_project(
    data: tauri::State<'_, LocalData>,
    project_id: String,
) -> Result<(), String> {
    data.delete_project(&project_id)
}

#[tauri::command(rename_all = "camelCase")]
fn import_local_asset(
    data: tauri::State<'_, LocalData>,
    project_id: String,
    source_path: String,
) -> Result<LocalAsset, String> {
    data.import_asset(&project_id, std::path::Path::new(&source_path))
}

#[tauri::command(rename_all = "camelCase")]
fn list_local_assets(
    data: tauri::State<'_, LocalData>,
    project_id: String,
) -> Result<Vec<LocalAsset>, String> {
    data.list_assets(&project_id)
}

#[tauri::command(rename_all = "camelCase")]
fn set_local_asset_role(
    data: tauri::State<'_, LocalData>,
    asset_id: String,
    role: String,
) -> Result<LocalAsset, String> {
    data.set_asset_role(&asset_id, &role)
}

#[tauri::command(rename_all = "camelCase")]
fn update_local_asset_upload(
    data: tauri::State<'_, LocalData>,
    asset_id: String,
    status: String,
    remote_reference_id: Option<String>,
    expires_at: Option<String>,
) -> Result<LocalAsset, String> {
    data.update_asset_upload(
        &asset_id,
        &status,
        remote_reference_id.as_deref(),
        expires_at.as_deref(),
    )
}

#[tauri::command(rename_all = "camelCase")]
fn get_local_asset_data_url(
    data: tauri::State<'_, LocalData>,
    asset_id: String,
) -> Result<String, String> {
    data.asset_data_url(&asset_id)
}

#[tauri::command(rename_all = "camelCase")]
fn create_local_task(data: tauri::State<'_, LocalData>, task: LocalTask) -> Result<(), String> {
    data.create_task(&task)
}

#[tauri::command(rename_all = "camelCase")]
fn update_local_task(data: tauri::State<'_, LocalData>, task: LocalTask) -> Result<(), String> {
    data.update_task(&task)
}

#[tauri::command(rename_all = "camelCase")]
fn get_local_task(
    data: tauri::State<'_, LocalData>,
    task_id: String,
) -> Result<Option<LocalTask>, String> {
    data.get_task(&task_id)
}

#[tauri::command(rename_all = "camelCase")]
fn list_local_tasks(
    data: tauri::State<'_, LocalData>,
    project_id: Option<String>,
) -> Result<Vec<LocalTask>, String> {
    data.list_tasks(project_id.as_deref())
}

#[tauri::command(rename_all = "camelCase")]
fn execute_local_mock_task(
    data: tauri::State<'_, LocalData>,
    task_id: String,
    asset_id: String,
) -> Result<GeneratedResult, String> {
    data.execute_mock_task(&task_id, &asset_id)
}

#[tauri::command(rename_all = "camelCase")]
async fn save_remote_generated_result(
    data: tauri::State<'_, LocalData>,
    task_id: String,
    remote_source: String,
    expected_mime_type: String,
) -> Result<GeneratedResult, String> {
    let local_data = data.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        local_data.save_remote_generated_result(&task_id, &remote_source, &expected_mime_type)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
fn list_local_results(
    data: tauri::State<'_, LocalData>,
    project_id: String,
) -> Result<Vec<GeneratedResult>, String> {
    data.list_results(&project_id)
}

#[tauri::command(rename_all = "camelCase")]
fn set_local_setting(
    data: tauri::State<'_, LocalData>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    data.set_setting(&key, &value)
}

#[tauri::command(rename_all = "camelCase")]
fn get_local_setting(
    data: tauri::State<'_, LocalData>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    data.get_setting(&key)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("WEAVIA");
            app.manage(LocalData::new(root).map_err(std::io::Error::other)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_secure_token,
            set_secure_token,
            clear_secure_tokens,
            get_device_info,
            get_local_data_info,
            create_local_project,
            list_local_projects,
            get_local_project,
            open_local_project,
            update_local_project,
            delete_local_project,
            import_local_asset,
            list_local_assets,
            set_local_asset_role,
            update_local_asset_upload,
            get_local_asset_data_url,
            create_local_task,
            update_local_task,
            get_local_task,
            list_local_tasks,
            execute_local_mock_task,
            save_remote_generated_result,
            list_local_results,
            set_local_setting,
            get_local_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running WEAVIA");
}
