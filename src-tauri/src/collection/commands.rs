use crate::collection::config::{read_collections, write_collections};
use crate::collection::utils::{
    find_api_in_collections, find_collection_item, get_collection_depth, remove_collection_item,
};
use crate::models::{Collection, FormField, Header};
use crate::saved_response::saved_response_config::get_api_saved_responses_index;

/// 递归加载 API 的保存响应索引
fn load_saved_responses_for_apis(collections: &mut [Collection], workspace_path: &str) {
    for item in collections.iter_mut() {
        if item.item_type == "api" {
            // 为 API 加载保存响应索引
            let saved_responses = get_api_saved_responses_index(workspace_path.to_string(), item.id.clone());
            if !saved_responses.is_empty() {
                item.saved_responses = Some(saved_responses);
            }
        }
        // 递归处理子项
        load_saved_responses_for_apis(&mut item.children, workspace_path);
    }
}

/// 获取集合列表
#[tauri::command]
pub fn get_collections(workspace_path: String) -> Vec<Collection> {
    let mut collections = read_collections(&workspace_path).collections;
    load_saved_responses_for_apis(&mut collections, &workspace_path);
    collections
}

/// 创建集合
#[tauri::command]
pub fn create_collection(
    workspace_path: String,
    name: String,
    description: Option<String>,
    parent_id: Option<String>,
) -> Result<Collection, String> {
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
        saved_responses: None,
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
pub fn create_api(
    workspace_path: String,
    name: String,
    method: String,
    url: String,
    parent_id: Option<String>,
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
        headers: Some(vec![Header {
            key: "Content-Type".to_string(),
            value: "application/json".to_string(),
            enabled: true,
        }]),
        body: Some(String::new()),
        body_type: Some("raw".to_string()),
        form_fields: None,
        binary_file_path: None,
        saved_responses: None,
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
    binary_file_path: Option<String>,
) -> Result<(), String> {
    let mut config = read_collections(&workspace_path);

    if let Some(api) = find_collection_item(&mut config.collections, &id) {
        if api.item_type != "api" {
            return Err("该项不是 API".to_string());
        }
        if let Some(n) = name {
            api.name = n;
        }
        if let Some(m) = method {
            api.method = Some(m);
        }
        if let Some(u) = url {
            api.url = Some(u);
        }
        if let Some(h) = headers {
            api.headers = Some(h);
        }
        if let Some(b) = body {
            api.body = Some(b);
        }
        if let Some(bt) = body_type {
            api.body_type = Some(bt);
        }
        if let Some(ff) = form_fields {
            api.form_fields = Some(ff);
        }
        if let Some(bfp) = binary_file_path {
            api.binary_file_path = Some(bfp);
        }
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
pub fn update_collection(
    workspace_path: String,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<(), String> {
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
pub fn move_api(
    workspace_path: String,
    api_id: String,
    target_collection_id: Option<String>,
) -> Result<(), String> {
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
