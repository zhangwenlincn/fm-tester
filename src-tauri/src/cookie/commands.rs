use crate::cookie::config::{get_cookies_config, save_cookies_config};
use crate::models::{Cookie, CookiesConfig};

#[tauri::command]
pub fn get_cookies(workspace_path: String) -> Result<Vec<Cookie>, String> {
    let config = get_cookies_config(workspace_path);
    Ok(config.cookies)
}

#[tauri::command]
pub fn clear_cookies(workspace_path: String) -> Result<(), String> {
    save_cookies_config(workspace_path, CookiesConfig::default())?;
    Ok(())
}

#[tauri::command]
pub fn delete_cookie(workspace_path: String, name: String, domain: String) -> Result<(), String> {
    let config = get_cookies_config(workspace_path.clone());
    let cookies: Vec<Cookie> = config
        .cookies
        .into_iter()
        .filter(|c| c.name != name || c.domain != domain)
        .collect();
    save_cookies_config(workspace_path, CookiesConfig { cookies })?;
    Ok(())
}

#[tauri::command]
pub fn add_cookie(workspace_path: String, cookie: Cookie) -> Result<(), String> {
    let config = get_cookies_config(workspace_path.clone());
    let mut cookies = config.cookies;
    // 检查是否存在相同 name+domain 的 cookie，则更新
    let existing_idx = cookies
        .iter()
        .position(|c| c.name == cookie.name && c.domain == cookie.domain);
    if let Some(idx) = existing_idx {
        cookies[idx] = cookie;
    } else {
        cookies.push(cookie);
    }
    save_cookies_config(workspace_path, CookiesConfig { cookies })?;
    Ok(())
}