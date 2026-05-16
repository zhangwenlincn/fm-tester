use crate::script::script_config::*;
use tauri::command;

/// 保存脚本
/// target_type: "api" | "collection" | "workspace"
/// script_kind: "pre" | "post"
#[command]
pub async fn save_script(
    workspace_path: String,
    target_type: String,
    target_id: Option<String>,
    script_kind: String,
    content: String,
) -> Result<(), String> {
    // 解析类型
    let target_type_enum = match target_type.as_str() {
        "api" => ScriptTargetType::Api,
        "collection" => ScriptTargetType::Collection,
        "workspace" => ScriptTargetType::Workspace,
        _ => return Err(format!("无效的脚本目标类型: {}", target_type)),
    };
    
    // 解析种类
    let script_kind_enum = match script_kind.as_str() {
        "pre" => ScriptKind::Pre,
        "post" => ScriptKind::Post,
        _ => return Err(format!("无效的脚本种类: {}", script_kind)),
    };
    
    // 生成文件名
    let filename = generate_script_filename(
        target_type_enum.clone(),
        target_id.as_deref(),
        script_kind_enum.clone(),
    );
    
    // 保存脚本文件
    save_script_file(&workspace_path, &filename, &content)?;
    
    // 更新索引
    let mut config = load_scripts_config(&workspace_path);
    
    // 查找是否已存在
    let existing_index = config.scripts.iter().position(|s| {
        s.target_type == target_type_enum 
            && s.target_id == target_id 
            && s.script_kind == script_kind_enum
    });
    
    let entry = ScriptIndexEntry {
        target_type: target_type_enum,
        target_id,
        script_kind: script_kind_enum,
        file: format!("scripts/{}", filename),
    };
    
    if let Some(index) = existing_index {
        config.scripts[index] = entry;
    } else {
        config.scripts.push(entry);
    }
    
    // 保存索引
    save_scripts_config(&workspace_path, &config)?;
    
    Ok(())
}

/// 获取脚本内容
#[command]
pub async fn get_script(
    workspace_path: String,
    target_type: String,
    target_id: Option<String>,
    script_kind: String,
) -> Result<String, String> {
    // 解析类型
    let target_type_enum = match target_type.as_str() {
        "api" => ScriptTargetType::Api,
        "collection" => ScriptTargetType::Collection,
        "workspace" => ScriptTargetType::Workspace,
        _ => return Err(format!("无效的脚本目标类型: {}", target_type)),
    };
    
    // 解析种类
    let script_kind_enum = match script_kind.as_str() {
        "pre" => ScriptKind::Pre,
        "post" => ScriptKind::Post,
        _ => return Err(format!("无效的脚本种类: {}", script_kind)),
    };
    
    // 从索引查找
    let config = load_scripts_config(&workspace_path);
    
    let entry = config.scripts.iter().find(|s| {
        s.target_type == target_type_enum 
            && s.target_id == target_id 
            && s.script_kind == script_kind_enum
    });
    
    if let Some(entry) = entry {
        // 从文件路径中提取文件名
        let filename = entry.file.replace("scripts/", "");
        read_script_file(&workspace_path, &filename)
    } else {
        Ok(String::new())
    }
}

/// 删除脚本
#[command]
pub async fn delete_script(
    workspace_path: String,
    target_type: String,
    target_id: Option<String>,
    script_kind: String,
) -> Result<(), String> {
    // 解析类型
    let target_type_enum = match target_type.as_str() {
        "api" => ScriptTargetType::Api,
        "collection" => ScriptTargetType::Collection,
        "workspace" => ScriptTargetType::Workspace,
        _ => return Err(format!("无效的脚本目标类型: {}", target_type)),
    };
    
    // 解析种类
    let script_kind_enum = match script_kind.as_str() {
        "pre" => ScriptKind::Pre,
        "post" => ScriptKind::Post,
        _ => return Err(format!("无效的脚本种类: {}", script_kind)),
    };
    
    // 从索引查找
    let mut config = load_scripts_config(&workspace_path);
    
    let index = config.scripts.iter().position(|s| {
        s.target_type == target_type_enum 
            && s.target_id == target_id 
            && s.script_kind == script_kind_enum
    });
    
    if let Some(index) = index {
        let entry = &config.scripts[index];
        let filename = entry.file.replace("scripts/", "");
        
        // 删除文件
        delete_script_file(&workspace_path, &filename)?;
        
        // 从索引移除
        config.scripts.remove(index);
        
        // 保存索引
        save_scripts_config(&workspace_path, &config)?;
    }
    
    Ok(())
}

/// 删除目标的所有脚本（删除 api/collection 时调用）
#[command]
pub async fn delete_target_scripts(
    workspace_path: String,
    target_type: String,
    target_id: Option<String>,
) -> Result<(), String> {
    // 解析类型
    let target_type_enum = match target_type.as_str() {
        "api" => ScriptTargetType::Api,
        "collection" => ScriptTargetType::Collection,
        "workspace" => ScriptTargetType::Workspace,
        _ => return Err(format!("无效的脚本目标类型: {}", target_type)),
    };
    
    let mut config = load_scripts_config(&workspace_path);
    
    // 找到所有匹配的脚本
    let to_delete: Vec<usize> = config.scripts.iter()
        .enumerate()
        .filter(|(_, s)| s.target_type == target_type_enum && s.target_id == target_id)
        .map(|(i, _)| i)
        .collect();
    
    // 删除文件和索引条目
    for index in to_delete.iter().rev() {
        let entry = &config.scripts[*index];
        let filename = entry.file.replace("scripts/", "");
        delete_script_file(&workspace_path, &filename)?;
        config.scripts.remove(*index);
    }
    
    // 保存索引
    if !to_delete.is_empty() {
        save_scripts_config(&workspace_path, &config)?;
    }
    
    Ok(())
}

/// 获取所有脚本列表
#[command]
pub async fn get_all_scripts(workspace_path: String) -> Result<Vec<ScriptIndexEntry>, String> {
    let config = load_scripts_config(&workspace_path);
    Ok(config.scripts)
}