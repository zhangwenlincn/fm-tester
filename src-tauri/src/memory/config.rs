use crate::models::MemoryConfig;
use std::fs;
use std::path::PathBuf;

/// 获取记忆配置文件路径
pub fn get_memory_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("memory.yaml")
}

/// 读取记忆配置
pub fn read_memory(workspace_path: &str) -> MemoryConfig {
    let path = get_memory_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        MemoryConfig::default()
    }
}

/// 写入记忆配置
pub fn write_memory(workspace_path: &str, config: &MemoryConfig) -> Result<(), String> {
    let path = get_memory_path(workspace_path);
    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}