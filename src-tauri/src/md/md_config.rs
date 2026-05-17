use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// 文档索引条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocIndexEntry {
    pub api_id: String,
    /// 最新编辑保存时间
    pub updated_at: String,
}

/// 文档索引文件结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DocIndex {
    pub entries: Vec<DocIndexEntry>,
}

/// 获取文档索引文件路径
pub fn get_doc_index_path(workspace_path: &str) -> PathBuf {
    PathBuf:: from(workspace_path)
        .join("md")
        .join("index.yaml")
}

/// 读取文档索引
pub fn read_doc_index(workspace_path: &str) -> DocIndex {
    let path = get_doc_index_path(workspace_path);
    
    if path.exists() {
        let content = fs::read_to_string(path).unwrap_or_default();
        if content.is_empty() {
            return DocIndex::default();
        }
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        DocIndex::default()
    }
}

/// 写入文档索引
pub fn write_doc_index(workspace_path: &str, index: &DocIndex) -> Result<(), String> {
    // 确保 md 目录存在
    let md_dir = PathBuf::from(workspace_path).join("md");
    if !md_dir.exists() {
        fs::create_dir_all(&md_dir)
            .map_err(|e| format!("创建 md 目录失败: {}", e))?;
    }
    
    let path = get_doc_index_path(workspace_path);
    
    let content = serde_yaml::to_string(index)
        .map_err(|e| format!("序列化索引失败: {}", e))?;
    
    fs::write(path, content)
        .map_err(|e| format!("写入索引失败: {}", e))
}

/// 更新文档索引（添加或更新条目）
pub fn update_doc_index(workspace_path: &str, api_id: &str, updated_at: &str) -> Result<(), String> {
    let mut index = read_doc_index(workspace_path);
    
    // 查找并更新，或添加新条目
    let found = index.entries.iter_mut().find(|e| e.api_id == api_id);
    if let Some(entry) = found {
        entry.updated_at = updated_at.to_string();
    } else {
        index.entries.push(DocIndexEntry {
            api_id: api_id.to_string(),
            updated_at: updated_at.to_string(),
        });
    }
    
    write_doc_index(workspace_path, &index)
}

/// 获取文档索引条目
pub fn get_doc_index_entry(workspace_path: &str, api_id: &str) -> Option<DocIndexEntry> {
    let index = read_doc_index(workspace_path);
    index.entries.iter().find(|e| e.api_id == api_id).cloned()
}

/// 获取 md 文件路径
/// 格式：{workspace_path}/md/{api_id}.md
pub fn get_api_doc_path(workspace_path: &str, api_id: &str) -> PathBuf {
    PathBuf::from(workspace_path)
        .join("md")
        .join(format!("{}.md", api_id))
}

/// 读取 API 文档
pub fn read_api_doc(workspace_path: &str, api_id: &str) -> Result<String, String> {
    let path = get_api_doc_path(workspace_path, api_id);
    
    if path.exists() {
        fs::read_to_string(path)
            .map_err(|e| format!("读取文档失败: {}", e))
    } else {
        // 文件不存在返回空字符串
        Ok(String::new())
    }
}

/// 获取当前时间字符串（ISO 8601 格式）
fn get_current_time() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

/// 写入 API 文档
pub fn write_api_doc(workspace_path: &str, api_id: &str, content: &str) -> Result<(), String> {
    // 确保 md 目录存在
    let md_dir = PathBuf::from(workspace_path).join("md");
    if !md_dir.exists() {
        fs::create_dir_all(&md_dir)
            .map_err(|e| format!("创建 md 目录失败: {}", e))?;
    }
    
    let path = get_api_doc_path(workspace_path, api_id);
    
    fs::write(path, content)
        .map_err(|e| format!("写入文档失败: {}", e))?;
    
    // 更新文档索引
    let updated_at = get_current_time();
    update_doc_index(workspace_path, api_id, &updated_at)?;
    
    Ok(())
}