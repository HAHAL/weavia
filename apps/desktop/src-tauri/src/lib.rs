use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo { name: &'static str, version: &'static str, platform: &'static str }

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo { name: "WEAVIA", version: env!("CARGO_PKG_VERSION"), platform: std::env::consts::OS }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_app_info])
        .run(tauri::generate_context!())
        .expect("error while running WEAVIA");
}
