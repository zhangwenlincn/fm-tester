use crate::history::history_config::*;
use crate::models::{Header, HistoryEntry, HttpResponse};
use chrono::Utc;
use uuid::Uuid;

/// 获取所有历史记录日期列表
#[tauri::command]
pub fn get_history_dates(workspace_path: String) -> Result<Vec<String>, String> {
    let dates = list_history_dates(workspace_path);
    Ok(dates)
}

/// 获取指定日期的历史记录列表
#[tauri::command]
pub fn get_history_by_date(workspace_path: String, date: String) -> Result<Vec<HistoryEntry>, String> {
    let entries = load_history_by_date(workspace_path, date);
    Ok(entries)
}

/// 获取单个历史记录详情
#[tauri::command]
pub fn get_history_entry(workspace_path: String, date: String, id: String) -> Result<HistoryEntry, String> {
    read_history_entry_file(workspace_path, date, id)
        .ok_or_else(|| "历史记录不存在".to_string())
}

/// 记录请求历史（在 send_http_request 中调用）
pub fn record_history(
    workspace_path: String,
    method: String,
    url: String,           // 原始 URL
    resolved_url: String,  // 替换变量后的 URL
    headers: Vec<Header>,
    body: Option<String>,
    body_type: Option<String>,
    form_fields: Option<Vec<crate::models::FormField>>,
    binary_file_path: Option<String>,
    response: &HttpResponse,
    api_id: Option<String>,
    api_name: Option<String>,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();

    let entry = HistoryEntry {
        id,
        method,
        url,
        resolved_url,
        headers,
        body,
        body_type,
        form_fields,
        binary_file_path,
        status: response.status,
        status_text: response.status_text.clone(),
        response_headers: response.headers.clone(),
        response_body: response.body.clone(),
        time: response.time,
        size: response.size,
        created_at,
        api_id,
        api_name,
    };

    save_history_entry_file(workspace_path, &entry)?;
    Ok(())
}

/// 删除单条历史记录
#[tauri::command]
pub fn delete_history_entry(workspace_path: String, date: String, id: String) -> Result<(), String> {
    delete_history_entry_file(workspace_path, date, id)?;
    Ok(())
}

/// 清空指定日期的历史记录
#[tauri::command]
pub fn clear_history_by_date(workspace_path: String, date: String) -> Result<(), String> {
    remove_history_by_date(workspace_path, date)?;
    Ok(())
}

/// 清空所有历史记录
#[tauri::command]
pub fn clear_all_history(workspace_path: String) -> Result<(), String> {
    remove_all_history(workspace_path)?;
    Ok(())
}