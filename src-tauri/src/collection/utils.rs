use crate::models::Collection;

/// 递归查找集合项
pub fn find_collection_item<'a>(
    items: &'a mut Vec<Collection>,
    id: &str,
) -> Option<&'a mut Collection> {
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
