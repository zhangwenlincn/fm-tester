use crate::models::AppSettings;
use crate::settings::settings_config::{read_settings, write_settings};

/// 获取全局设置
#[tauri::command]
pub fn get_settings() -> AppSettings {
    read_settings()
}

/// 更新全局设置
#[tauri::command]
pub fn update_settings(timeout: u64, language: Option<String>) -> Result<AppSettings, String> {
    let mut settings = read_settings();
    settings.request_timeout = timeout;
    if let Some(lang) = language {
        settings.language = lang;
    }
    write_settings(&settings)?;
    Ok(settings)
}