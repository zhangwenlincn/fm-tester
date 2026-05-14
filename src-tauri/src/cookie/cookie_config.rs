use crate::models::CookiesConfig;
use std::fs;
use std::path::PathBuf;

/// 获取工作区的 Cookie 配置文件路径
pub fn get_cookies_config_path(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join("cookies.yaml")
}

/// 读取 Cookie 配置
pub fn get_cookies_config(workspace_path: String) -> CookiesConfig {
    let path = get_cookies_config_path(&workspace_path);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        CookiesConfig::default()
    }
}

/// 写入 Cookie 配置
pub fn save_cookies_config(
    workspace_path: String,
    config: CookiesConfig,
) -> Result<(), String> {
    let path = get_cookies_config_path(&workspace_path);

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let content = serde_yaml::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}