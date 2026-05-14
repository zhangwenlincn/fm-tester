use crate::models::WorkspaceConfig;
use std::fs;
use std::path::PathBuf;

/// 获取工作区配置文件路径
pub fn get_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".fm").join("workspace.yaml")
}

/// 读取工作区配置
pub fn read_config() -> WorkspaceConfig {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        WorkspaceConfig::default()
    }
}

/// 写入工作区配置
pub fn write_config(config: &WorkspaceConfig) -> Result<(), String> {
    let path = get_config_path();

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}
