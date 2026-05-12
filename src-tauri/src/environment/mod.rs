use crate::models::{Environment, EnvironmentsConfig};
use std::fs;
use std::path::PathBuf;

/// 获取工作区的环境配置文件路径
pub fn get_environments_config_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("environments.yaml")
}

/// 读取环境配置
pub fn read_environments_config(workspace_path: &str) -> EnvironmentsConfig {
    let path = get_environments_config_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        EnvironmentsConfig::default()
    }
}

/// 写入环境配置
pub fn write_environments_config(
    workspace_path: &str,
    config: &EnvironmentsConfig,
) -> Result<(), String> {
    let path = get_environments_config_path(workspace_path);

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

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
        // 创建新环境
        config.environments.push(environment.clone());

        // 如果没有激活环境，设置为新创建的环境
        if config.active_environment_id.is_none() {
            config.active_environment_id = Some(environment.id.clone());
        }
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
pub fn get_active_variables(workspace_path: String) -> std::collections::HashMap<String, String> {
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

    std::collections::HashMap::new()
}

/// 替换字符串中的环境变量 {{变量名}}
pub fn replace_variables(
    text: &str,
    variables: &std::collections::HashMap<String, String>,
) -> String {
    let mut result = text.to_string();

    for (key, value) in variables {
        let pattern = format!("{{{{{}}}}}", key);
        result = result.replace(&pattern, value);
    }

    result
}
