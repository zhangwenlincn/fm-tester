use crate::models::{HistoryConfig, HistoryEntry};
use chrono::{DateTime, Utc};
use std::fs;
use std::path::PathBuf;

/// 获取历史记录根目录
pub fn get_history_dir(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("history")
}

/// 获取指定日期的目录路径
pub fn get_history_date_dir(workspace_path: &str, date: &str) -> PathBuf {
    get_history_dir(workspace_path).join(date)
}

/// 获取指定日期的索引文件路径
pub fn get_history_date_index_path(workspace_path: &str, date: &str) -> PathBuf {
    get_history_date_dir(workspace_path, date).join("index.yaml")
}

/// 获取单个历史记录文件路径
pub fn get_history_entry_path(workspace_path: &str, date: &str, id: &str) -> PathBuf {
    get_history_date_dir(workspace_path, date).join(format!("{}.yaml", id))
}

/// 从时间戳提取日期字符串（YYYY-MM-DD）
pub fn extract_date(timestamp: &str) -> String {
    // 解析 RFC3339 格式的时间戳
    if let Ok(dt) = DateTime::parse_from_rfc3339(timestamp) {
        dt.format("%Y-%m-%d").to_string()
    } else {
        // 解析失败，使用当前日期
        Utc::now().format("%Y-%m-%d").to_string()
    }
}

/// 读取指定日期的索引
pub fn get_history_date_index(workspace_path: String, date: String) -> Vec<HistoryEntry> {
    let path = get_history_date_index_path(&workspace_path, &date);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        let config: HistoryConfig = serde_yaml::from_str(&content).unwrap_or_default();
        config.entries
    } else {
        Vec::new()
    }
}

/// 保存指定日期的索引
pub fn save_history_date_index(
    workspace_path: String,
    date: String,
    entries: Vec<HistoryEntry>,
) -> Result<(), String> {
    let dir = get_history_date_dir(&workspace_path, &date);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let path = get_history_date_index_path(&workspace_path, &date);
    let config = HistoryConfig { entries };
    let content = serde_yaml::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 保存单个历史记录文件
pub fn save_history_entry_file(
    workspace_path: String,
    entry: &HistoryEntry,
) -> Result<(), String> {
    let date = extract_date(&entry.created_at);
    let dir = get_history_date_dir(&workspace_path, &date);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    // 保存记录文件
    let entry_path = get_history_entry_path(&workspace_path, &date, &entry.id);
    let content = serde_yaml::to_string(entry).map_err(|e| e.to_string())?;
    fs::write(&entry_path, content).map_err(|e| e.to_string())?;

    // 更新当天索引
    let mut index_entries = get_history_date_index(workspace_path.clone(), date.clone());
    // 添加到索引（只保留简要信息，实际存储在单独文件）
    index_entries.push(entry.clone());
    // 按时间倒序排列
    index_entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    save_history_date_index(workspace_path, date, index_entries)?;

    Ok(())
}

/// 读取单个历史记录文件
pub fn read_history_entry_file(
    workspace_path: String,
    date: String,
    id: String,
) -> Option<HistoryEntry> {
    let path = get_history_entry_path(&workspace_path, &date, &id);
    if path.exists() {
        let content = fs::read_to_string(&path).ok()?;
        serde_yaml::from_str(&content).ok()
    } else {
        None
    }
}

/// 删除单个历史记录
pub fn delete_history_entry_file(
    workspace_path: String,
    date: String,
    id: String,
) -> Result<(), String> {
    // 删除记录文件
    let entry_path = get_history_entry_path(&workspace_path, &date, &id);
    if entry_path.exists() {
        fs::remove_file(&entry_path).map_err(|e| e.to_string())?;
    }

    // 更新当天索引
    let mut index_entries = get_history_date_index(workspace_path.clone(), date.clone());
    index_entries.retain(|e| e.id != id);
    save_history_date_index(workspace_path, date, index_entries)?;

    Ok(())
}

/// 获取所有有历史记录的日期列表
pub fn list_history_dates(workspace_path: String) -> Vec<String> {
    let dir = get_history_dir(&workspace_path);
    if !dir.exists() {
        return Vec::new();
    }

    let mut dates = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let name = entry.file_name().to_string_lossy().to_string();
                // 只读取目录名（日期格式 YYYY-MM-DD）
                if entry.path().is_dir() && name.len() == 10 && name.contains('-') {
                    dates.push(name);
                }
            }
        }
    }

    // 按日期倒序排列（最新的在最前面）
    dates.sort_by(|a, b| b.cmp(a));
    dates
}

/// 获取指定日期的历史记录列表
pub fn load_history_by_date(workspace_path: String, date: String) -> Vec<HistoryEntry> {
    get_history_date_index(workspace_path, date)
}

/// 清空指定日期的历史记录
pub fn remove_history_by_date(workspace_path: String, date: String) -> Result<(), String> {
    let dir = get_history_date_dir(&workspace_path, &date);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 清空所有历史记录
pub fn remove_all_history(workspace_path: String) -> Result<(), String> {
    let dir = get_history_dir(&workspace_path);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}