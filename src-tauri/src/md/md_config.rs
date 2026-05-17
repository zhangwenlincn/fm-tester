use std::fs;
use std::path::PathBuf;

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
        .map_err(|e| format!("写入文档失败: {}", e))
}