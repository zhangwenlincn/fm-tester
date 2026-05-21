use crate::import::openapi_parser::parse_openapi;
use crate::import::import_converter::convert_to_collection;
use crate::import::curl_parser::{parse_curl_command, ParsedCurl};
use crate::models::Collection;
use crate::collection::collection_config::{read_collections, write_collections};
use crate::collection::collection_utils::find_collection_item;
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

#[tauri::command]
pub fn parse_curl(curl_command: String) -> Result<ParsedCurl, String> {
    parse_curl_command(&curl_command)
}