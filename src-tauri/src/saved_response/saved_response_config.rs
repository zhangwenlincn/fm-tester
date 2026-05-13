use crate::models::{SavedResponse, SavedResponsesIndex, SavedResponseIndexEntry};
use std::fs;
use std::path::PathBuf;

/// 获取工作区的 saved_responses 目录路径
pub fn get_saved_responses_dir(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("saved_responses")
}

/// 获取响应索引文件路径
pub fn get_saved_responses_index_path(workspace_path: &str) -> PathBuf {
    get_saved_responses_dir(workspace_path).join("index.yaml")
}

/// 读取响应索引
pub fn get_saved_responses_index(workspace_path: String) -> SavedResponsesIndex {
    let path = get_saved_responses_index_path(&workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        SavedResponsesIndex::default()
    }
}

/// 保存响应索引
pub fn save_saved_responses_index(
    workspace_path: String,
    index: SavedResponsesIndex,
) -> Result<(), String> {
    let dir = get_saved_responses_dir(&workspace_path);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let path = get_saved_responses_index_path(&workspace_path);
    let content = serde_yaml::to_string(&index).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取单个响应文件路径
pub fn get_saved_response_path(workspace_path: &str, id: &str) -> PathBuf {
    get_saved_responses_dir(workspace_path).join(format!("{}.yaml", id))
}

/// 保存响应到文件
pub fn save_saved_response_file(workspace_path: String, response: &SavedResponse) -> Result<(), String> {
    let dir = get_saved_responses_dir(&workspace_path);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let path = get_saved_response_path(&workspace_path, &response.id);
    let content = serde_yaml::to_string(response).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 读取单个响应文件
pub fn read_saved_response_file(workspace_path: String, id: String) -> Option<SavedResponse> {
    let path = get_saved_response_path(&workspace_path, &id);
    if path.exists() {
        let content = fs::read_to_string(&path).ok()?;
        serde_yaml::from_str(&content).ok()
    } else {
        None
    }
}

/// 删除响应文件
pub fn delete_saved_response_file(workspace_path: String, id: String) -> Result<(), String> {
    let path = get_saved_response_path(&workspace_path, &id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 获取指定 API 的保存响应索引
pub fn get_api_saved_responses_index(
    workspace_path: String,
    api_id: String,
) -> Vec<SavedResponseIndexEntry> {
    let index = get_saved_responses_index(workspace_path);
    index
        .responses
        .into_iter()
        .filter(|r| r.api_id == Some(api_id.clone()))
        .collect()
}