use crate::environment::environment_config::{read_environments_config, write_environments_config};
use crate::models::{Environment, EnvironmentsConfig};
use std::collections::HashMap;

/// 获取所有环境
#[tauri::command]
pub fn get_environments(workspace_path: String) -> EnvironmentsConfig {
    read_environments_config(&workspace_path)
}

/// 保存环境（创建或更新）
#[tauri::command]
pub fn save_environment(
    workspace_path: String,
    environment: Environment,
) -> Result<Environment, String> {
    let mut config = read_environments_config(&workspace_path);

    // 查找是否存在相同 id 的环境
    let existing = config
        .environments
        .iter_mut()
        .find(|e| e.id == environment.id);

    if let Some(env) = existing {
        // 更新现有环境
        *env = environment.clone();
    } else {
        // 创建新环境，不自动设置为激活环境
        config.environments.push(environment.clone());
    }

    write_environments_config(&workspace_path, &config)?;
    Ok(environment)
}

/// 删除环境
#[tauri::command]
pub fn delete_environment(workspace_path: String, environment_id: String) -> Result<(), String> {
    let mut config = read_environments_config(&workspace_path);

    config.environments.retain(|e| e.id != environment_id);

    // 如果删除的是当前激活的环境，清除激活状态或切换到第一个环境
    if config.active_environment_id == Some(environment_id) {
        config.active_environment_id = config.environments.first().map(|e| e.id.clone());
    }

    write_environments_config(&workspace_path, &config)?;
    Ok(())
}

/// 切换激活环境
#[tauri::command]
pub fn switch_environment(workspace_path: String, environment_id: String) -> Result<(), String> {
    let mut config = read_environments_config(&workspace_path);

    // 验证环境是否存在
    if !config.environments.iter().any(|e| e.id == environment_id) {
        return Err("环境不存在".to_string());
    }

    config.active_environment_id = Some(environment_id);
    write_environments_config(&workspace_path, &config)?;
    Ok(())
}

/// 获取当前激活环境的变量映射
#[tauri::command]
pub fn get_active_variables(workspace_path: String) -> HashMap<String, String> {
    let config = read_environments_config(&workspace_path);

    if let Some(active_id) = config.active_environment_id {
        if let Some(env) = config.environments.iter().find(|e| e.id == active_id) {
            return env
                .variables
                .iter()
                .filter(|v| v.enabled)
                .map(|v| (v.key.clone(), v.value.clone()))
                .collect();
        }
    }

    HashMap::new()
}

/// 环境排序
#[tauri::command]
pub fn reorder_environments(
    workspace_path: String,
    environment_id: String,
    new_index: usize,
) -> Result<(), String> {
    let mut config = read_environments_config(&workspace_path);

    // 查找环境当前位置
    let current_index = config
        .environments
        .iter()
        .position(|e| e.id == environment_id)
        .ok_or_else(|| "环境不存在".to_string())?;

    // 移动环境到新位置
    if current_index != new_index {
        let environment = config.environments.remove(current_index);
        // 确保新索引在有效范围内
        let insert_index = new_index.min(config.environments.len());
        config.environments.insert(insert_index, environment);
        write_environments_config(&workspace_path, &config)?;
    }

    Ok(())
}
