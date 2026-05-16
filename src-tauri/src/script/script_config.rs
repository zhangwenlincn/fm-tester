use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 脚本类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScriptTargetType {
    Api,
    Collection,
    Workspace,
}

/// 脚本种类
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScriptKind {
    Pre,
    Post,
}

/// 脚本索引条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptIndexEntry {
    /// 目标类型（api/collection/workspace）
    pub target_type: ScriptTargetType,
    /// 目标 ID（api 或 collection 的 id，workspace 时为空）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_id: Option<String>,
    /// 脚本种类（pre/post）
    pub script_kind: ScriptKind,
    /// 脚本文件路径（相对于工作区）
    pub file: String,
}

/// 脚本索引配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScriptsConfig {
    pub scripts: Vec<ScriptIndexEntry>,
}

/// 获取脚本目录路径
pub fn get_scripts_dir(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("scripts")
}

/// 获取脚本索引文件路径
pub fn get_scripts_config_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("scripts.yaml")
}

/// 加载脚本索引配置
pub fn load_scripts_config(workspace_path: &str) -> ScriptsConfig {
    let config_path = get_scripts_config_path(workspace_path);
    
    if !config_path.exists() {
        return ScriptsConfig::default();
    }
    
    match fs::read_to_string(&config_path) {
        Ok(content) => {
            match serde_yaml::from_str::<ScriptsConfig>(&content) {
                Ok(config) => config,
                Err(e) => {
                    eprintln!("解析脚本索引失败: {}", e);
                    ScriptsConfig::default()
                }
            }
        }
        Err(e) => {
            eprintln!("读取脚本索引失败: {}", e);
            ScriptsConfig::default()
        }
    }
}

/// 保存脚本索引配置
pub fn save_scripts_config(workspace_path: &str, config: &ScriptsConfig) -> Result<(), String> {
    let config_path = get_scripts_config_path(workspace_path);
    
    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    
    let content = serde_yaml::to_string(config).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&config_path, content).map_err(|e| format!("写入文件失败: {}", e))?;
    
    Ok(())
}

/// 生成脚本文件名
pub fn generate_script_filename(target_type: ScriptTargetType, target_id: Option<&str>, script_kind: ScriptKind) -> String {
    let kind_str = if script_kind == ScriptKind::Pre { "pre" } else { "post" };
    
    match target_type {
        ScriptTargetType::Workspace => format!("workspace_{}.js", kind_str),
        ScriptTargetType::Collection => format!("collection_{}_{}.js", target_id.unwrap_or("unknown"), kind_str),
        ScriptTargetType::Api => format!("api_{}_{}.js", target_id.unwrap_or("unknown"), kind_str),
    }
}

/// 保存脚本内容到文件
pub fn save_script_file(workspace_path: &str, filename: &str, content: &str) -> Result<(), String> {
    let scripts_dir = get_scripts_dir(workspace_path);
    
    // 确保脚本目录存在
    if !scripts_dir.exists() {
        fs::create_dir_all(&scripts_dir).map_err(|e| format!("创建脚本目录失败: {}", e))?;
    }
    
    let file_path = scripts_dir.join(filename);
    fs::write(&file_path, content).map_err(|e| format!("写入脚本文件失败: {}", e))?;
    
    Ok(())
}

/// 读取脚本内容
pub fn read_script_file(workspace_path: &str, filename: &str) -> Result<String, String> {
    let scripts_dir = get_scripts_dir(workspace_path);
    let file_path = scripts_dir.join(filename);
    
    if !file_path.exists() {
        return Ok(String::new());
    }
    
    fs::read_to_string(&file_path).map_err(|e| format!("读取脚本文件失败: {}", e))
}

/// 删除脚本文件
pub fn delete_script_file(workspace_path: &str, filename: &str) -> Result<(), String> {
    let scripts_dir = get_scripts_dir(workspace_path);
    let file_path = scripts_dir.join(filename);
    
    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| format!("删除脚本文件失败: {}", e))?;
    }
    
    Ok(())
}