use crate::collection::{find_api_in_collections, read_collections};
use crate::models::{Collection, Workspace};
use crate::workspace::workspace_config::{read_config, write_config};
use std::fs;
use std::path::PathBuf;

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
pub fn create_workspace(
    name: String,
    description: String,
    path: String,
) -> Result<Workspace, String> {
    let mut config = read_config();

    // 检查工作区名称是否重复
    if config.workspaces.iter().any(|w| w.name == name) {
        return Err("工作区名称已存在，请使用其他名称".to_string());
    }

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
pub fn get_last_api(workspace_id: String) -> Result<Option<Collection>, String> {
    let config = read_config();

    let workspace = config
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| "工作区不存在".to_string())?;

    if let Some(api_id) = &workspace.last_api_id {
        let collections = read_collections(&workspace.path);
        if let Some(api) = find_api_in_collections(&collections.collections, api_id) {
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

/// 工作区排序
#[tauri::command]
pub fn reorder_workspaces(workspace_id: String, new_index: usize) -> Result<(), String> {
    let mut config = read_config();

    // 查找工作区当前位置
    let current_index = config
        .workspaces
        .iter()
        .position(|w| w.id == workspace_id)
        .ok_or_else(|| "工作区不存在".to_string())?;

    // 移动工作区到新位置
    if current_index != new_index {
        let workspace = config.workspaces.remove(current_index);
        // 确保新索引在有效范围内
        let insert_index = new_index.min(config.workspaces.len());
        config.workspaces.insert(insert_index, workspace);
        write_config(&config)?;
    }

    Ok(())
}
