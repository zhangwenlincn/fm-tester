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
    let mut config = read_memory(&workspace_path);
    config.expanded_ids = expanded_ids;
    write_memory(&workspace_path, &config)
}

/// 获取打开的标签页ID列表和激活索引
#[tauri::command]
pub fn get_open_tabs(workspace_path: String) -> (Vec<String>, usize) {
    let config = read_memory(&workspace_path);
    (config.open_tabs, config.active_tab_index)
}

/// 保存打开的标签页ID列表和激活索引
#[tauri::command]
pub fn save_open_tabs(
    workspace_path: String,
    open_tabs: Vec<String>,
    active_tab_index: usize,
) -> Result<(), String> {
    let mut config = read_memory(&workspace_path);
    config.open_tabs = open_tabs;
    config.active_tab_index = active_tab_index;
    write_memory(&workspace_path, &config)
}