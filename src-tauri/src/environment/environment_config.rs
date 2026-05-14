use crate::models::EnvironmentsConfig;
use std::fs;
use std::path::PathBuf;

/// 获取工作区的环境配置文件路径
pub fn get_environments_config_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("environments.yaml")
}

/// 读取环境配置
pub fn read_environments_config(workspace_path: &str) -> EnvironmentsConfig {
    let path = get_environments_config_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        EnvironmentsConfig::default()
    }
}

/// 写入环境配置
pub fn write_environments_config(
    workspace_path: &str,
    config: &EnvironmentsConfig,
) -> Result<(), String> {
    let path = get_environments_config_path(workspace_path);

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}
