use crate::models::AppSettings;
use crate::settings::settings_config::{read_settings, write_settings};
use tauri::{AppHandle, Emitter};

/// 获取全局设置
#[tauri::command]
pub fn get_settings() -> AppSettings {
    read_settings()
}

/// 更新全局设置
#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    timeout: u64,
    language: Option<String>,
    git_update_check_interval: Option<u64>,
) -> Result<AppSettings, String> {
    let mut settings = read_settings();
    settings.request_timeout = timeout;
    if let Some(lang) = language {
        settings.language = lang;
    }
    if let Some(interval) = git_update_check_interval {
        settings.git_update_check_interval = interval;
    }
    write_settings(&settings)?;
    
    // 发送设置更新事件通知前端
    app.emit("settings-updated", &settings).ok();
    
    Ok(settings)
}