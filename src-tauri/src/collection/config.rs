use crate::models::CollectionsConfig;
use std::fs;
use std::path::PathBuf;

/// 获取集合配置文件路径
pub fn get_collections_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("collections.yaml")
}

/// 读取集合配置
pub fn read_collections(workspace_path: &str) -> CollectionsConfig {
    let path = get_collections_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        CollectionsConfig::default()
    }
}

/// 写入集合配置
pub fn write_collections(workspace_path: &str, config: &CollectionsConfig) -> Result<(), String> {
    let path = get_collections_path(workspace_path);
    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}
