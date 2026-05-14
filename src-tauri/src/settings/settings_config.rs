use crate::models::AppSettings;
use std::fs;
use std::path::PathBuf;

/// 获取全局设置文件路径
pub fn get_settings_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".fm").join("settings.yaml")
}

/// 读取全局设置
pub fn read_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

/// 写入全局设置
pub fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let content = serde_yaml::to_string(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}