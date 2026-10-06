use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_secure_token,
            set_secure_token,
            clear_secure_tokens,
            get_device_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running WEAVIA");
}
