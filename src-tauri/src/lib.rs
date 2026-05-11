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
            update_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}