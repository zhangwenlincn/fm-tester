use crate::models::{Collection, CollectionsConfig, Header, FormField};
use std::fs;
use std::path::PathBuf;

/// 获取集合配置文件路径
pub fn get_collections_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("collections.yaml")
}

/// 读取集合配置
pub fn read_collections(workspace_path: &str) -> CollectionsConfig {
    let path = get_collections_path(workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        CollectionsConfig::default()
    }
}

/// 写入集合配置
pub fn write_collections(workspace_path: &str, config: &CollectionsConfig) -> Result<(), String> {
    let path = get_collections_path(workspace_path);
    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 递归查找集合项
pub fn find_collection_item<'a>(items: &'a mut Vec<Collection>, id: &str) -> Option<&'a mut Collection> {
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
pub fn remove_collection_item(items: &mut Vec<Collection>, id: &str) -> bool {
    let initial_len = items.len();
    items.retain(|item| item.id != id);
    if items.len() < initial_len {
        return true;
    }
    for item in items.iter_mut() {
        if remove_collection_item(&mut item.children, id) {
            return true;
        }
    }
    false
}

/// 递归查找 API
pub fn find_api_in_collections<'a>(items: &'a [Collection], id: &str) -> Option<&'a Collection> {
    for item in items {
        if item.id == id && item.item_type == "api" {
            return Some(item);
        }
        if let Some(found) = find_api_in_collections(&item.children, id) {
            return Some(found);
        }
    }
    None
}

/// 递归获取集合深度
pub fn get_collection_depth(items: &[Collection], id: &str, current_depth: usize) -> Option<usize> {
    for item in items {
        if item.id == id {
            return Some(current_depth);
        }
        if let Some(d) = get_collection_depth(&item.children, id, current_depth + 1) {
            return Some(d);
        }
    }
    None
}

/// 获取集合列表
#[tauri::command]
pub fn get_collections(workspace_path: String) -> Vec<Collection> {
    read_collections(&workspace_path).collections
}

/// 创建集合
#[tauri::command]
pub fn create_collection(workspace_path: String, name: String, description: Option<String>, parent_id: Option<String>) -> Result<Collection, String> {
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
        form_fields: None,
        binary_file_path: None,
    };
    
    if let Some(pid) = parent_id {
        if let Some(parent) = find_collection_item(&mut config.collections, &pid) {
            parent.children.push(collection.clone());
        } else {
            return Err("父集合不存在".to_string());
        }
    } else {
        config.collections.push(collection.clone());
    }
    
    write_collections(&workspace_path, &config)?;
    Ok(collection)
}

/// 创建 API 接口
#[tauri::command]
pub fn create_api(workspace_path: String, name: String, method: String, url: String, parent_id: Option<String>) -> Result<Collection, String> {
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
        form_fields: None,
        binary_file_path: None,
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
pub fn update_api(
    workspace_path: String,
    id: String,
    name: Option<String>,
    method: Option<String>,
    url: Option<String>,
    headers: Option<Vec<Header>>,
    body: Option<String>,
    body_type: Option<String>,
    form_fields: Option<Vec<FormField>>,
    binary_file_path: Option<String>
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
        if let Some(ff) = form_fields { api.form_fields = Some(ff); }
        if let Some(bfp) = binary_file_path { api.binary_file_path = Some(bfp); }
    } else {
        return Err("API 不存在".to_string());
    }
    
    write_collections(&workspace_path, &config)?;
    Ok(())
}

/// 删除集合或接口
#[tauri::command]
pub fn delete_collection_item(workspace_path: String, id: String) -> Result<(), String> {
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
pub fn update_collection(workspace_path: String, id: String, name: String, description: Option<String>) -> Result<(), String> {
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

/// 移动 API 到另一个集合
#[tauri::command]
pub fn move_api(workspace_path: String, api_id: String, target_collection_id: Option<String>) -> Result<(), String> {
    let mut config = read_collections(&workspace_path);
    
    // 先克隆 API 数据，再从原位置移除
    let api = if let Some(found_api) = find_api_in_collections(&config.collections, &api_id) {
        let cloned = found_api.clone();
        remove_collection_item(&mut config.collections, &api_id);
        cloned
    } else {
        return Err("API 不存在".to_string());
    };
    
    // 验证 API 类型
    if api.item_type != "api" {
        return Err("只能移动 API".to_string());
    }
    
    // 添加到目标位置
    if let Some(target_id) = target_collection_id {
        // 先检查目标集合的深度（限制最多三层）
        let target_depth = get_collection_depth(&config.collections, &target_id, 0).unwrap_or(0);
        if target_depth >= 2 {
            return Err("集合最多三层，无法移动到更深层".to_string());
        }
        
        if let Some(target) = find_collection_item(&mut config.collections, &target_id) {
            if target.item_type != "collection" {
                return Err("目标不是集合".to_string());
            }
            target.children.push(api);
        } else {
            return Err("目标集合不存在".to_string());
        }
    } else {
        // 移动到根级别
        config.collections.push(api);
    }
    
    write_collections(&workspace_path, &config)?;
    Ok(())
}