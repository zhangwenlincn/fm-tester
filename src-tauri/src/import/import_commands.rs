use crate::import::openapi_parser::parse_openapi;
use crate::import::import_converter::convert_to_collection;
use crate::import::curl_parser::{parse_curl_command, ParsedCurl};
use crate::import::postman_parser::parse_postman;
use crate::import::postman_converter::convert_postman_to_collection;
use crate::import::export_postman_converter::convert_collection_to_postman;
use crate::models::Collection;
use crate::collection::collection_config::{read_collections, write_collections};
use crate::collection::collection_utils::{find_collection_item, find_item_in_collections};
use uuid::Uuid;

#[tauri::command]
pub fn preview_openapi(
    content: String,
    format: String,
    root_name: Option<String>,
) -> Result<Collection, String> {
    let openapi = parse_openapi(&content, &format)?;
    let collection = convert_to_collection(openapi, None, root_name)?;
    Ok(collection)
}

fn assign_new_ids(collection: &mut Collection) {
    collection.id = Uuid::new_v4().to_string();
    for child in &mut collection.children {
        assign_new_ids(child);
    }
}

#[tauri::command]
pub fn import_openapi(
    workspace_path: String,
    content: String,
    format: String,
    target_collection_id: Option<String>,
    root_name: Option<String>,
) -> Result<Collection, String> {
    let openapi = parse_openapi(&content, &format)?;
    let mut root_collection = convert_to_collection(openapi, None, root_name)?;
    
    let mut config = read_collections(&workspace_path);
    
    if let Some(parent_id) = target_collection_id.clone() {
        let parent = find_collection_item(&mut config.collections, &parent_id)
            .ok_or_else(|| format!("目标集合不存在: {}", parent_id))?;
        
        if parent.item_type != "collection" {
            return Err("目标必须是集合".to_string());
        }
        
        // 直接将 tag 集合合并到目标集合，不创建额外的根层级
        for child in &mut root_collection.children {
            assign_new_ids(child);
            parent.children.push(child.clone());
        }
        write_collections(&workspace_path, &config)?;
        Ok(root_collection)
    } else {
assign_new_ids(&mut root_collection);
        config.collections.push(root_collection.clone());
        write_collections(&workspace_path, &config)?;
        Ok(root_collection)
    }
}

/// 导出集合为 Postman 2.1 格式 JSON（从文件读取）
#[tauri::command]
pub fn export_collection_postman(
    workspace_path: String,
    collection_id: String,
) -> Result<String, String> {
    let config = read_collections(&workspace_path);
    
    let collection = find_item_in_collections(&config.collections, &collection_id)
        .ok_or_else(|| format!("集合不存在: {}", collection_id))?;
    
    if collection.item_type != "collection" {
        return Err("只能导出集合".to_string());
    }
    
    let postman_collection = convert_collection_to_postman(collection);
    
    serde_json::to_string_pretty(&postman_collection)
        .map_err(|e| format!("序列化失败: {}", e))
}

/// 导出集合为 Postman 2.1 格式 JSON（使用前端处理过的数据）
#[tauri::command]
pub fn export_collection_postman_with_data(
    collection: Collection,
) -> Result<String, String> {
    if collection.item_type != "collection" {
        return Err("只能导出集合".to_string());
    }
    
    let postman_collection = convert_collection_to_postman(&collection);
    
    serde_json::to_string_pretty(&postman_collection)
        .map_err(|e| format!("序列化失败: {}", e))
}

#[tauri::command]
pub fn parse_curl(curl_command: String) -> Result<ParsedCurl, String> {
    parse_curl_command(&curl_command)
}

#[tauri::command]
pub fn preview_postman(
    content: String,
    root_name: Option<String>,
) -> Result<Collection, String> {
    let postman = parse_postman(&content)?;
    let collection = convert_postman_to_collection(postman, root_name)?;
    Ok(collection)
}

#[tauri::command]
pub fn import_postman(
    workspace_path: String,
    content: String,
    target_collection_id: Option<String>,
    root_name: Option<String>,
) -> Result<Collection, String> {
    let postman = parse_postman(&content)?;
    let mut root_collection = convert_postman_to_collection(postman, root_name)?;
    
    let mut config = read_collections(&workspace_path);
    
    if let Some(parent_id) = target_collection_id.clone() {
        let parent = find_collection_item(&mut config.collections, &parent_id)
            .ok_or_else(|| format!("目标集合不存在: {}", parent_id))?;
        
        if parent.item_type != "collection" {
            return Err("目标必须是集合".to_string());
        }
        
        assign_new_ids(&mut root_collection);
        for child in &root_collection.children {
            parent.children.push(child.clone());
        }
        write_collections(&workspace_path, &config)?;
        Ok(root_collection)
    } else {
        assign_new_ids(&mut root_collection);
        config.collections.push(root_collection.clone());
        write_collections(&workspace_path, &config)?;
        Ok(root_collection)
    }
}