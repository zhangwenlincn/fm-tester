use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    /// 思考过程内容
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

/// 聊天会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub created_at: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

/// 聊天记录配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChatConfig {
    pub sessions: HashMap<String, ChatSession>,
    pub active_session_id: Option<String>,
}

/// 获取聊天记录文件路径
fn get_chat_config_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("chat.yaml")
}

/// 读取聊天记录
fn read_chat_config(workspace_path: &str) -> ChatConfig {
    let path = get_chat_config_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        ChatConfig::default()
    }
}

/// 写入聊天记录
fn write_chat_config(workspace_path: &str, config: &ChatConfig) -> Result<(), String> {
    let path = get_chat_config_path(workspace_path);

    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 保存聊天记录
#[tauri::command]
pub fn save_chat_history(
    app: AppHandle,
    workspace_path: String,
    session_id: Option<String>,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is empty".to_string());
    }

    let mut config = read_chat_config(&workspace_path);
    
    // 生成session_id（如果没有提供）
    let session_id = session_id.unwrap_or_else(|| {
        chrono::Utc::now().format("%Y%m%d%H%M%S").to_string()
    });

    // 获取现有标题（如果是更新已有会话）
    let existing_title = config.sessions.get(&session_id).and_then(|s| s.title.clone());
    
    // 创建或更新会话
    let session = ChatSession {
        id: session_id.clone(),
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        messages,
        title: existing_title,
    };

    config.sessions.insert(session_id.clone(), session);
    config.active_session_id = Some(session_id.clone());

    write_chat_config(&workspace_path, &config)?;

    // 发送事件通知前端刷新会话列表
    app.emit("chat-session-saved", &session_id).ok();

    Ok(session_id)
}

/// 获取聊天记录
#[tauri::command]
pub fn get_chat_history(
    workspace_path: String,
    session_id: Option<String>,
) -> Result<Vec<ChatMessage>, String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is empty".to_string());
    }

    let config = read_chat_config(&workspace_path);

    // 获取指定会话或活动会话
    let target_id = session_id.or(config.active_session_id);

    if let Some(id) = target_id {
        if let Some(session) = config.sessions.get(&id) {
            return Ok(session.messages.clone());
        }
    }

    // 返回空列表
    Ok(Vec::new())
}

/// 清空聊天记录
#[tauri::command]
pub fn clear_chat_history(
    workspace_path: String,
    session_id: Option<String>,
) -> Result<(), String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is empty".to_string());
    }

    let mut config = read_chat_config(&workspace_path);

    // 清空指定会话或活动会话
    if let Some(id) = session_id.or(config.active_session_id.clone()) {
        config.sessions.remove(&id);
        if config.active_session_id == Some(id) {
            config.active_session_id = None;
        }
    }

    write_chat_config(&workspace_path, &config)?;

    Ok(())
}

/// 获取聊天会话列表
#[tauri::command]
pub fn get_chat_sessions(workspace_path: String) -> Result<Vec<ChatSession>, String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is empty".to_string());
    }

    let config = read_chat_config(&workspace_path);
    
    // 按创建时间倒序排列
    let mut sessions: Vec<ChatSession> = config.sessions.values().cloned().collect();
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(sessions)
}

/// 删除聊天会话
#[tauri::command]
pub fn delete_chat_session(
    workspace_path: String,
    session_id: String,
) -> Result<(), String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is empty".to_string());
    }

    let mut config = read_chat_config(&workspace_path);
    config.sessions.remove(&session_id);
    
    if config.active_session_id == Some(session_id) {
        config.active_session_id = None;
    }
    
    write_chat_config(&workspace_path, &config)?;
    
    Ok(())
}

/// 重命名聊天会话
#[tauri::command]
pub fn rename_chat_session(
    workspace_path: String,
    session_id: String,
    new_title: String,
) -> Result<(), String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is empty".to_string());
    }

    let mut config = read_chat_config(&workspace_path);
    
    if let Some(session) = config.sessions.get_mut(&session_id) {
        session.title = Some(new_title);
        write_chat_config(&workspace_path, &config)?;
        Ok(())
    } else {
        Err("Session not found".to_string())
    }
}