use crate::models::{
    Cookie, SavedRequest, SavedResponse, SavedResponseData, SavedResponseIndexEntry,
};
use crate::saved_response::config::*;
use chrono::Utc;
use uuid::Uuid;

#[tauri::command]
pub fn save_response(
    workspace_path: String,
    name: String,
    api_id: Option<String>,
    request: SavedRequest,
    response: SavedResponseData,
    cookies: Vec<Cookie>,
) -> Result<SavedResponse, String> {
    // 创建 SavedResponse
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();

    let saved_response = SavedResponse {
        id: id.clone(),
        name: name.clone(),
        created_at: created_at.clone(),
        api_id: api_id.clone(),
        request: request.clone(),
        response: response.clone(),
        cookies: cookies.clone(),
    };

    // 保存到文件
    save_saved_response_file(workspace_path.clone(), &saved_response)?;

    // 更新索引
    let mut index = get_saved_responses_index(workspace_path.clone());
    let index_entry = SavedResponseIndexEntry {
        id: id.clone(),
        name,
        method: request.method,
        url: request.resolved_url,
        status: response.status,
        created_at,
        api_id,
    };
    index.responses.push(index_entry);
    save_saved_responses_index(workspace_path, index)?;

    Ok(saved_response)
}

#[tauri::command]
pub fn get_saved_responses(
    workspace_path: String,
) -> Result<Vec<SavedResponseIndexEntry>, String> {
    let index = get_saved_responses_index(workspace_path);
    Ok(index.responses)
}

#[tauri::command]
pub fn get_saved_response(workspace_path: String, id: String) -> Result<SavedResponse, String> {
    read_saved_response_file(workspace_path, id).ok_or_else(|| "响应不存在".to_string())
}

#[tauri::command]
pub fn delete_saved_response(workspace_path: String, id: String) -> Result<(), String> {
    // 删除响应文件
    delete_saved_response_file(workspace_path.clone(), id.clone())?;

    // 更新索引
    let mut index = get_saved_responses_index(workspace_path.clone());
    index.responses.retain(|entry| entry.id != id);
    save_saved_responses_index(workspace_path, index)?;

    Ok(())
}

#[tauri::command]
pub fn get_api_saved_responses(
    workspace_path: String,
    api_id: String,
) -> Result<Vec<SavedResponseIndexEntry>, String> {
    let index = get_saved_responses_index(workspace_path);
    let responses = index
        .responses
        .into_iter()
        .filter(|r| r.api_id == Some(api_id.clone()))
        .collect();
    Ok(responses)
}