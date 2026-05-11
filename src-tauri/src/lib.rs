use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 工作区信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub created_at: String,
    pub last_opened: String,
}

/// HTTP 请求头
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Header {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

/// API 接口
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Api {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<Header>,
    pub body: String,
    pub body_type: String,
}

/// 集合（可包含子集合和接口）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub item_type: String,  // "collection" 或 "api"
    pub children: Vec<Collection>,
    // 仅当 type == "api" 时有效
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<Vec<Header>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_type: Option<String>,
}

/// 集合配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CollectionsConfig {
    pub collections: Vec<Collection>,
}

/// 工作区配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub workspaces: Vec<Workspace>,
    pub last_workspace_id: Option<String>,
}

impl Default for WorkspaceConfig {
    fn default() -> Self {
        Self {
            workspaces: Vec::new(),
            last_workspace_id: None,
        }
    }
}

/// 获取工作区配置文件路径
fn get_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".fm").join("workspace.yaml")
}

/// 读取工作区配置
fn read_config() -> WorkspaceConfig {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        WorkspaceConfig::default()
    }
}

/// 写入工作区配置
fn write_config(config: &WorkspaceConfig) -> Result<(), String> {
    let path = get_config_path();
    
    // 确保目录存在
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    
    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取所有工作区
#[tauri::command]
fn get_workspaces() -> Vec<Workspace> {
    read_config().workspaces
}

/// 获取最近打开的工作区
#[tauri::command]
fn get_last_workspace() -> Option<Workspace> {
    let config = read_config();
    if let Some(id) = config.last_workspace_id {
        config.workspaces.iter().find(|w| w.id == id).cloned()
    } else {
        None
    }
}

/// 创建新工作区
#[tauri::command]
fn create_workspace(name: String, description: String, path: String) -> Result<Workspace, String> {
    let mut config = read_config();
    
    // 检查路径是否存在，不存在则创建
    let workspace_path = PathBuf::from(&path);
    if !workspace_path.exists() {
        fs::create_dir_all(&workspace_path).map_err(|e| format!("无法创建目录: {}", e))?;
    }
    
    // 生成唯一ID
    let id = format!("ws_{}", chrono::Local::now().timestamp());
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let workspace = Workspace {
        id: id.clone(),
        name,
        description,
        path,
        created_at: now.clone(),
        last_opened: now,
    };
    
    config.workspaces.push(workspace.clone());
    config.last_workspace_id = Some(id);
    
    write_config(&config)?;
    Ok(workspace)
}

/// 切换工作区
#[tauri::command]
fn switch_workspace(id: String) -> Result<Workspace, String> {
    let mut config = read_config();
    
    let workspace = config
        .workspaces
        .iter()
        .find(|w| w.id == id)
        .cloned()
        .ok_or_else(|| "工作区不存在".to_string())?;
    
    // 更新最后打开时间
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for w in &mut config.workspaces {
        if w.id == id {
            w.last_opened = now.clone();
            break;
        }
    }
    
    config.last_workspace_id = Some(id);
    write_config(&config)?;
    
    Ok(workspace)
}

/// 删除工作区
#[tauri::command]
fn delete_workspace(id: String) -> Result<(), String> {
    let mut config = read_config();
    
    config.workspaces.retain(|w| w.id != id);
    
    if config.last_workspace_id == Some(id) {
        config.last_workspace_id = config.workspaces.first().map(|w| w.id.clone());
    }
    
    write_config(&config)?;
    Ok(())
}

/// 更新工作区信息
#[tauri::command]
fn update_workspace(id: String, name: String, description: String) -> Result<(), String> {
    let mut config = read_config();
    
    for w in &mut config.workspaces {
        if w.id == id {
            w.name = name;
            w.description = description;
            break;
        }
    }
    
    write_config(&config)?;
    Ok(())
}

/// 获取集合配置文件路径
fn get_collections_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("collections.yaml")
}

/// 读取集合配置
fn read_collections(workspace_path: &str) -> CollectionsConfig {
    let path = get_collections_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        CollectionsConfig::default()
    }
}

/// 写入集合配置
fn write_collections(workspace_path: &str, config: &CollectionsConfig) -> Result<(), String> {
    let path = get_collections_path(workspace_path);
    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 递归查找集合项
fn find_collection_item<'a>(items: &'a mut Vec<Collection>, id: &str) -> Option<&'a mut Collection> {
    for item in items.iter_mut() {
        if item.id == id {
            return Some(item);
        }
        if let Some(found) = find_collection_item(&mut item.children, id) {
            return Some(found);
        }
    }
    None
}

/// 递归删除集合项
fn remove_collection_item(items: &mut Vec<Collection>, id: &str) -> bool {
    // 先尝试从当前层级删除
    let initial_len = items.len();
    items.retain(|item| item.id != id);
    if items.len() < initial_len {
        return true;
    }
    // 递归到子层级删除
    for item in items.iter_mut() {
        if remove_collection_item(&mut item.children, id) {
            return true;
        }
    }
    false
}

/// 获取集合列表
#[tauri::command]
fn get_collections(workspace_path: String) -> Vec<Collection> {
    read_collections(&workspace_path).collections
}

/// 创建集合
#[tauri::command]
fn create_collection(workspace_path: String, name: String, description: Option<String>, parent_id: Option<String>) -> Result<Collection, String> {
    let mut config = read_collections(&workspace_path);
    
    let id = format!("col_{}", chrono::Local::now().timestamp_millis());
    
    let collection = Collection {
        id: id.clone(),
        name,
        description,
        item_type: "collection".to_string(),
        children: Vec::new(),
        method: None,
        url: None,
        headers: None,
        body: None,
        body_type: None,
    };
    
    if let Some(pid) = parent_id {
        // 添加到父集合
        if let Some(parent) = find_collection_item(&mut config.collections, &pid) {
            parent.children.push(collection.clone());
        } else {
            return Err("父集合不存在".to_string());
        }
    } else {
        // 添加到根级别
        config.collections.push(collection.clone());
    }
    
    write_collections(&workspace_path, &config)?;
    Ok(collection)
}

/// 创建 API 接口
#[tauri::command]
fn create_api(
    workspace_path: String,
    name: String,
    method: String,
    url: String,
    parent_id: Option<String>
) -> Result<Collection, String> {
    let mut config = read_collections(&workspace_path);
    
    let id = format!("api_{}", chrono::Local::now().timestamp_millis());
    
    let api = Collection {
        id: id.clone(),
        name,
        description: None,
        item_type: "api".to_string(),
        children: Vec::new(),
        method: Some(method),
        url: Some(url),
        headers: Some(vec![
            Header { key: "Content-Type".to_string(), value: "application/json".to_string(), enabled: true }
        ]),
        body: Some(String::new()),
        body_type: Some("raw".to_string()),
    };
    
    if let Some(pid) = parent_id {
        if let Some(parent) = find_collection_item(&mut config.collections, &pid) {
            parent.children.push(api.clone());
        } else {
            return Err("父集合不存在".to_string());
        }
    } else {
        config.collections.push(api.clone());
    }
    
    write_collections(&workspace_path, &config)?;
    Ok(api)
}

/// 更新 API 接口
#[tauri::command]
fn update_api(
    workspace_path: String,
    id: String,
    name: Option<String>,
    method: Option<String>,
    url: Option<String>,
    headers: Option<Vec<Header>>,
    body: Option<String>,
    body_type: Option<String>
) -> Result<(), String> {
    let mut config = read_collections(&workspace_path);
    
    if let Some(api) = find_collection_item(&mut config.collections, &id) {
        if api.item_type != "api" {
            return Err("该项不是 API".to_string());
        }
        if let Some(n) = name { api.name = n; }
        if let Some(m) = method { api.method = Some(m); }
        if let Some(u) = url { api.url = Some(u); }
        if let Some(h) = headers { api.headers = Some(h); }
        if let Some(b) = body { api.body = Some(b); }
        if let Some(bt) = body_type { api.body_type = Some(bt); }
    } else {
        return Err("API 不存在".to_string());
    }
    
    write_collections(&workspace_path, &config)?;
    Ok(())
}

/// 删除集合或接口
#[tauri::command]
fn delete_collection_item(workspace_path: String, id: String) -> Result<(), String> {
    let mut config = read_collections(&workspace_path);
    
    if remove_collection_item(&mut config.collections, &id) {
        write_collections(&workspace_path, &config)?;
        Ok(())
    } else {
        Err("该项不存在".to_string())
    }
}

/// 更新集合名称
#[tauri::command]
fn update_collection(workspace_path: String, id: String, name: String, description: Option<String>) -> Result<(), String> {
    let mut config = read_collections(&workspace_path);
    
    if let Some(col) = find_collection_item(&mut config.collections, &id) {
        if col.item_type != "collection" {
            return Err("该项不是集合".to_string());
        }
        col.name = name;
        col.description = description;
    } else {
        return Err("集合不存在".to_string());
    }
    
    write_collections(&workspace_path, &config)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_workspaces,
            get_last_workspace,
            create_workspace,
            switch_workspace,
            delete_workspace,
            update_workspace,
            get_collections,
            create_collection,
            create_api,
            update_api,
            delete_collection_item,
            update_collection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}