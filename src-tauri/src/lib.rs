use std::{fs, path::PathBuf};

use tauri::{AppHandle, Manager};

const TIMER_SNAPSHOT_FILE: &str = "timer-snapshot.json";
const HISTORY_FILE: &str = "history.json";
const SETTINGS_FILE: &str = "settings.json";

fn app_data_file_path(app_handle: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app data directory: {error}"))?;

    Ok(app_data_dir.join(file_name))
}

fn load_json_file(app_handle: &AppHandle, file_name: &str, label: &str) -> Result<Option<serde_json::Value>, String> {
    let file_path = app_data_file_path(app_handle, file_name)?;

    if !file_path.exists() {
        return Ok(None);
    }

    let file_content = fs::read_to_string(&file_path)
        .map_err(|error| format!("failed to read {label}: {error}"))?;
    let value = serde_json::from_str(&file_content)
        .map_err(|error| format!("failed to parse {label}: {error}"))?;

    Ok(Some(value))
}

fn save_json_file(
    app_handle: &AppHandle,
    file_name: &str,
    label: &str,
    value: serde_json::Value,
) -> Result<(), String> {
    let file_path = app_data_file_path(app_handle, file_name)?;
    let file_content = serde_json::to_string_pretty(&value)
        .map_err(|error| format!("failed to serialize {label}: {error}"))?;

    fs::write(file_path, file_content)
        .map_err(|error| format!("failed to write {label}: {error}"))
}

#[tauri::command]
fn load_timer_snapshot(app_handle: AppHandle) -> Result<Option<serde_json::Value>, String> {
    load_json_file(&app_handle, TIMER_SNAPSHOT_FILE, "timer snapshot")
}

#[tauri::command]
fn save_timer_snapshot(
    app_handle: AppHandle,
    snapshot: serde_json::Value,
) -> Result<(), String> {
    save_json_file(&app_handle, TIMER_SNAPSHOT_FILE, "timer snapshot", snapshot)
}

#[tauri::command]
fn load_history(app_handle: AppHandle) -> Result<Option<serde_json::Value>, String> {
    load_json_file(&app_handle, HISTORY_FILE, "history")
}

#[tauri::command]
fn save_history(app_handle: AppHandle, history: serde_json::Value) -> Result<(), String> {
    save_json_file(&app_handle, HISTORY_FILE, "history", history)
}

#[tauri::command]
fn load_settings(app_handle: AppHandle) -> Result<Option<serde_json::Value>, String> {
    load_json_file(&app_handle, SETTINGS_FILE, "settings")
}

#[tauri::command]
fn save_settings(app_handle: AppHandle, settings: serde_json::Value) -> Result<(), String> {
    save_json_file(&app_handle, SETTINGS_FILE, "settings", settings)
}

/// Position a window by label using WebviewWindow::set_position.
/// Falls back to no-op on error so the Rust side never panics.
#[tauri::command]
fn position_window(app_handle: AppHandle, label: String, x: i32, y: i32) {
    if let Some(window) = app_handle.get_webview_window(&label) {
        // Physical position in pixels, relative to screen origin
        let pos = tauri::PhysicalPosition::new(x, y);
        let _ = window.set_position(tauri::Position::Physical(pos));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_timer_snapshot,
            save_timer_snapshot,
            load_history,
            save_history,
            load_settings,
            save_settings,
            position_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}