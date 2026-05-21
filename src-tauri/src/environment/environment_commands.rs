use crate::collection::{find_ancestor_chain, read_collections};
use crate::environment::environment_config::{read_environments_config, write_environments_config};
use crate::environment::replace_variables;
use crate::models::{Environment, EnvironmentsConfig, Variable, VariableInfo};
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

/// 获取可用的变量列表（用于前端变量提示）
/// 变量优先级：接口 > 子集合 > 父集合 > 环境（高优先级覆盖低优先级同名变量）
/// 参数：
/// - workspace_path: 工作区路径
/// - environment_id: 选中的环境ID（可选）
/// - item_id: 集合ID或接口ID
/// - item_type: "collection" 或 "api"
#[tauri::command]
pub fn get_available_variables(
    workspace_path: String,
    environment_id: Option<String>,
    item_id: String,
    _item_type: String,
) -> Vec<VariableInfo> {
    // 使用 HashMap 存储变量，key 唯一，高优先级覆盖低优先级
    let mut variables_map: std::collections::HashMap<String, VariableInfo> =
        std::collections::HashMap::new();

    // 1. 环境变量（优先级最低，最先处理，会被后面的覆盖）
    let env_config = read_environments_config(&workspace_path);
    let target_env_id = environment_id.or(env_config.active_environment_id);

    if let Some(env_id) = target_env_id {
        if let Some(env) = env_config.environments.iter().find(|e| e.id == env_id) {
            for v in &env.variables {
                if v.enabled {
                    variables_map.insert(
                        v.key.clone(),
                        VariableInfo {
                            key: v.key.clone(),
                            value: v.value.clone(),
                            source: env.name.clone(),
                            description: v.description.clone(),
                        },
                    );
                }
            }
        }
    }

    // 2. 集合变量（从根到近，子集合覆盖父集合）
    // ancestor_chain: [根集合, ..., 父集合, 该集合/API]
    // 正向遍历：从低优先级（根集合）到高优先级（最近集合）
    // 高优先级在后，会覆盖前面的同名变量
    let collections_config = read_collections(&workspace_path);
    let mut ancestor_chain: Vec<crate::models::Collection> = Vec::new();

    if find_ancestor_chain(&collections_config.collections, &item_id, &mut ancestor_chain) {
        for collection in ancestor_chain.iter() {
            // 跳过 API 本身（API 没有变量）
            if collection.item_type != "collection" {
                continue;
            }
            if let Some(collection_vars) = &collection.collection_variables {
                for v in collection_vars {
                    if v.enabled {
                        variables_map.insert(
                            v.key.clone(),
                            VariableInfo {
                                key: v.key.clone(),
                                value: v.value.clone(),
                                source: collection.name.clone(),
                                description: v.description.clone(),
                            },
                        );
                    }
                }
            }
        }
    }

    // 转换为 Vec 返回
    variables_map.values().cloned().collect()
}

/// 替换文本中的变量
#[tauri::command]
pub fn replace_variables_text(text: String, variables: Vec<Variable>) -> String {
    let vars_map: HashMap<String, String> = variables
        .iter()
        .filter(|v| v.enabled && !v.key.is_empty())
        .map(|v| (v.key.clone(), v.value.clone()))
        .collect();
    
    replace_variables(&text, &vars_map).text
}
