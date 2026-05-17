use crate::md::md_config::{read_api_doc, write_api_doc};
use tauri::command;

/// 获取 API 文档内容
#[command]
pub fn get_api_doc(workspace_path: String, api_id: String) -> Result<String, String> {
    read_api_doc(&workspace_path, &api_id)
}

/// 保存 API 文档内容
#[command]
pub fn save_api_doc(workspace_path: String, api_id: String, content: String) -> Result<(), String> {
    write_api_doc(&workspace_path, &api_id, &content)
}