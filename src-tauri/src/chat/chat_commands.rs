use tauri::{AppHandle, Emitter};

use super::chat_config::{
    read_chat_index, read_session, write_chat_index, write_session,
    delete_session_file, session_to_index_entry, ChatMessage, ChatSession,
};

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

    // 生成 session_id（如果没有提供）
    let session_id = session_id.unwrap_or_else(|| {
        chrono::Utc::now().format("%Y%m%d%H%M%S").to_string()
    });

    // 读取现有索引
    let mut index = read_chat_index(&workspace_path);

    // 获取现有标题（如果是更新已有会话）
    let existing_title = index
        .sessions
        .iter()
        .find(|s| s.id == session_id)
        .and_then(|s| s.title.clone());

    // 创建或更新会话
    let session = ChatSession {
        id: session_id.clone(),
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        messages,
        title: existing_title,
    };

    // 写入会话文件
    write_session(&workspace_path, &session)?;

    // 更新索引
    let index_entry = session_to_index_entry(&session);
    if let Some(pos) = index.sessions.iter().position(|s| s.id == session_id) {
        index.sessions[pos] = index_entry;
    } else {
        index.sessions.insert(0, index_entry);
    }
    index.active_session_id = Some(session_id.clone());

    // 写入索引文件
    write_chat_index(&workspace_path, &index)?;

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

    let index = read_chat_index(&workspace_path);

    // 获取指定会话或活动会话
    let target_id = session_id.or(index.active_session_id);

    if let Some(id) = target_id {
        if let Some(session) = read_session(&workspace_path, &id) {
            return Ok(session.messages);
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

    let mut index = read_chat_index(&workspace_path);

    // 清空指定会话或活动会话
    if let Some(id) = session_id.or(index.active_session_id.clone()) {
        // 删除会话文件
        delete_session_file(&workspace_path, &id)?;
        
        // 更新索引
        index.sessions.retain(|s| s.id != id);
        if index.active_session_id == Some(id) {
            index.active_session_id = None;
        }

        write_chat_index(&workspace_path, &index)?;
    }

    Ok(())
}

/// 获取聊天会话列表（仅索引信息）
#[tauri::command]
pub fn get_chat_sessions(workspace_path: String) -> Result<Vec<ChatSession>, String> {
    if workspace_path.is_empty() {
        return Err("Workspace path is empty".to_string());
    }

    let index = read_chat_index(&workspace_path);

    // 按创建时间倒序排列（索引已按此顺序存储，无需重排）
    // 将索引条目转换为会话对象（不含消息内容，节省内存）
    let sessions: Vec<ChatSession> = index
        .sessions
        .into_iter()
        .map(|s| ChatSession {
            id: s.id,
            created_at: s.created_at,
            messages: Vec::new(), // 列表不需要消息内容
            title: s.title,
        })
        .collect();

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

    // 删除会话文件
    delete_session_file(&workspace_path, &session_id)?;

    // 更新索引
    let mut index = read_chat_index(&workspace_path);
    index.sessions.retain(|s| s.id != session_id);

    if index.active_session_id == Some(session_id.clone()) {
        index.active_session_id = None;
    }

    write_chat_index(&workspace_path, &index)?;

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

    // 读取并更新会话文件
    if let Some(mut session) = read_session(&workspace_path, &session_id) {
        session.title = Some(new_title.clone());
        write_session(&workspace_path, &session)?;

        // 更新索引
        let mut index = read_chat_index(&workspace_path);
        if let Some(entry) = index.sessions.iter_mut().find(|s| s.id == session_id) {
            entry.title = Some(new_title);
            write_chat_index(&workspace_path, &index)?;
        }

        Ok(())
    } else {
        Err("Session not found".to_string())
    }
}