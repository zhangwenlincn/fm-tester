use crate::models::MemoryConfig;
use crate::memory::config::{read_memory, write_memory};

/// 获取展开的集合ID列表
#[tauri::command]
pub fn get_expanded_collections(workspace_path: String) -> Vec<String> {
    read_memory(&workspace_path).expanded_ids
}

/// 保存展开的集合ID列表
#[tauri::command]
pub fn save_expanded_collections(
    workspace_path: String,
    expanded_ids: Vec<String>,
) -> Result<(), String> {
    let config = MemoryConfig { expanded_ids };
    write_memory(&workspace_path, &config)
}