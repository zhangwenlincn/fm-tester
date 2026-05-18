use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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

/// 聊天会话（完整数据，存储在单独文件中）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub created_at: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

/// 聊天会话索引条目（存储在 index.yaml 中）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSessionIndex {
    pub id: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub message_count: usize,
}

/// 聊天索引文件结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChatIndex {
    pub sessions: Vec<ChatSessionIndex>,
    pub active_session_id: Option<String>,
}

// ========== 文件路径函数 ==========

/// 获取 chat 文件夹路径
pub fn get_chat_dir(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("chat")
}

/// 获取索引文件路径
pub fn get_chat_index_path(workspace_path: &str) -> PathBuf {
    get_chat_dir(workspace_path).join("index.yaml")
}

/// 获取会话文件路径
pub fn get_session_path(workspace_path: &str, session_id: &str) -> PathBuf {
    get_chat_dir(workspace_path).join(format!("{}.yaml", session_id))
}

// ========== 文件操作函数 ==========

/// 确保 chat 目录存在
pub fn ensure_chat_dir(workspace_path: &str) -> Result<(), String> {
    let dir = get_chat_dir(workspace_path);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create chat directory: {}", e))?;
    }
    Ok(())
}

/// 读取聊天索引
pub fn read_chat_index(workspace_path: &str) -> ChatIndex {
    let path = get_chat_index_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        ChatIndex::default()
    }
}

/// 写入聊天索引
pub fn write_chat_index(workspace_path: &str, index: &ChatIndex) -> Result<(), String> {
    ensure_chat_dir(workspace_path)?;
    let path = get_chat_index_path(workspace_path);
    let content = serde_yaml::to_string(index).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 读取单个会话
pub fn read_session(workspace_path: &str, session_id: &str) -> Option<ChatSession> {
    let path = get_session_path(workspace_path, session_id);
    if path.exists() {
        let content = fs::read_to_string(&path).ok()?;
        serde_yaml::from_str(&content).ok()
    } else {
        None
    }
}

/// 写入单个会话
pub fn write_session(workspace_path: &str, session: &ChatSession) -> Result<(), String> {
    ensure_chat_dir(workspace_path)?;
    let path = get_session_path(workspace_path, &session.id);
    let content = serde_yaml::to_string(session).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 删除会话文件
pub fn delete_session_file(workspace_path: &str, session_id: &str) -> Result<(), String> {
    let path = get_session_path(workspace_path, session_id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 从完整会话创建索引条目
pub fn session_to_index_entry(session: &ChatSession) -> ChatSessionIndex {
    ChatSessionIndex {
        id: session.id.clone(),
        created_at: session.created_at.clone(),
        title: session.title.clone(),
        message_count: session.messages.len(),
    }
}