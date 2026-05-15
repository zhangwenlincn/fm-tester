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

/// 获取父集合的 children 数组可变引用
/// parent_id 为 None 时返回根级别 collections
pub fn find_parent_children<'a>(
    items: &'a mut Vec<Collection>,
    parent_id: Option<&str>,
) -> Option<&'a mut Vec<Collection>> {
    match parent_id {
        None => Some(items),
        Some(pid) => {
            for item in items.iter_mut() {
                if item.id == pid && item.item_type == "collection" {
                    return Some(&mut item.children);
                }
                if let Some(found) = find_parent_children(&mut item.children, Some(pid)) {
                    return Some(found);
                }
            }
            None
        }
    }
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

/// 获取集合的所有子孙 ID（用于检查是否移动到自己的子集）
pub fn get_all_descendant_ids(items: &[Collection], id: &str) -> Option<Vec<String>> {
    // 先找到该集合
    for item in items {
        if item.id == id && item.item_type == "collection" {
            // 收集所有子孙 ID
            let mut result = Vec::new();
            collect_descendant_ids(&item.children, &mut result);
            return Some(result);
        }
        if let Some(found) = get_all_descendant_ids(&item.children, id) {
            return Some(found);
        }
    }
    None
}

/// 递归收集子孙 ID
fn collect_descendant_ids(items: &[Collection], result: &mut Vec<String>) {
    for item in items {
        result.push(item.id.clone());
        collect_descendant_ids(&item.children, result);
    }
}

/// 获取集合的最大子层级深度（用于检查移动后是否超过层级限制）
pub fn get_collection_max_child_depth(items: &[Collection], id: &str) -> Option<usize> {
    // 先找到该集合
    for item in items {
        if item.id == id && item.item_type == "collection" {
            return Some(get_max_depth_in_tree(&item.children, 0));
        }
        if let Some(d) = get_collection_max_child_depth(&item.children, id) {
            return Some(d);
        }
    }
    None
}

/// 计算树的最大深度
fn get_max_depth_in_tree(items: &[Collection], current_depth: usize) -> usize {
    if items.is_empty() {
        return current_depth;
    }
    let mut max = current_depth;
    for item in items {
        let child_max = get_max_depth_in_tree(&item.children, current_depth + 1);
        if child_max > max {
            max = child_max;
        }
    }
    max
}
