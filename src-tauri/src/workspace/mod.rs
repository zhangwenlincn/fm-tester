use crate::models::{Workspace, WorkspaceConfig};
use std::fs;
use std::path::PathBuf;

/// 获取工作区配置文件路径
pub fn get_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".fm").join("workspace.yaml")
}

/// 读取工作区配置
pub fn read_config() -> WorkspaceConfig {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        WorkspaceConfig::default()
    }
}

/// 写入工作区配置
pub fn write_config(config: &WorkspaceConfig) -> Result<(), String> {
    let path = get_config_path();
    
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
pub fn get_workspaces() -> Vec<Workspace> {
    read_config().workspaces
}

/// 获取最近打开的工作区
#[tauri::command]
pub fn get_last_workspace() -> Option<Workspace> {
    let config = read_config();
    if let Some(id) = config.last_workspace_id {
        config.workspaces.iter().find(|w| w.id == id).cloned()
    } else {
        None
    }
}

/// 创建新工作区
#[tauri::command]
pub fn create_workspace(name: String, description: String, path: String) -> Result<Workspace, String> {
    let mut config = read_config();
    
    let workspace_path = PathBuf::from(&path);
    if !workspace_path.exists() {
        fs::create_dir_all(&workspace_path).map_err(|e| format!("无法创建目录: {}", e))?;
    }
    
    let id = format!("ws_{}", chrono::Local::now().timestamp());
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let workspace = Workspace {
        id: id.clone(),
        name,
        description,
        path,
        created_at: now.clone(),
        last_opened: now,
        last_api_id: None,
    };
    
    config.workspaces.push(workspace.clone());
    config.last_workspace_id = Some(id);
    
    write_config(&config)?;
    Ok(workspace)
}

/// 切换工作区
#[tauri::command]
pub fn switch_workspace(id: String) -> Result<Workspace, String> {
    let mut config = read_config();
    
    let workspace = config
        .workspaces
        .iter()
        .find(|w| w.id == id)
        .cloned()
        .ok_or_else(|| "工作区不存在".to_string())?;
    
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
pub fn delete_workspace(id: String) -> Result<(), String> {
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
pub fn update_workspace(id: String, name: String, description: String) -> Result<(), String> {
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

/// 设置最后打开的接口
#[tauri::command]
pub fn set_last_api(workspace_id: String, api_id: String) -> Result<(), String> {
    let mut config = read_config();
    
    for w in &mut config.workspaces {
        if w.id == workspace_id {
            w.last_api_id = Some(api_id);
            break;
        }
    }
    
    write_config(&config)?;
    Ok(())
}

/// 获取最后打开的接口
#[tauri::command]
pub fn get_last_api(workspace_id: String) -> Result<Option<crate::models::Collection>, String> {
    let config = read_config();
    
    let workspace = config
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| "工作区不存在".to_string())?;
    
    if let Some(api_id) = &workspace.last_api_id {
        let collections = crate::collection::read_collections(&workspace.path);
        if let Some(api) = crate::collection::find_api_in_collections(&collections.collections, api_id) {
            return Ok(Some(api.clone()));
        }
    }
    
    Ok(None)
}

/// 设置最后打开的工作区
#[tauri::command]
pub fn set_last_workspace(workspace_id: String) -> Result<(), String> {
    let mut config = read_config();
    
    // 验证工作区是否存在
    if !config.workspaces.iter().any(|w| w.id == workspace_id) {
        return Err("工作区不存在".to_string());
    }
    
    // 更新最后打开时间
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for w in &mut config.workspaces {
        if w.id == workspace_id {
            w.last_opened = now;
            break;
        }
    }
    
    config.last_workspace_id = Some(workspace_id);
    write_config(&config)?;
    Ok(())
}