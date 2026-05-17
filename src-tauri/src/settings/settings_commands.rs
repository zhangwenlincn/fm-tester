use crate::models::{AppSettings, Header, AiSettings};
use crate::settings::settings_config::{read_settings, write_settings};
use crate::git::encrypt_string;
use tauri::{AppHandle, Emitter};

/// 获取全局设置（API Key 返回隐藏值）
#[tauri::command]
pub fn get_settings() -> AppSettings {
    let settings = read_settings();
    // 隐藏加密后的 API Key，返回占位符
    AppSettings {
        request_timeout: settings.request_timeout,
        language: settings.language,
        git_update_check_interval: settings.git_update_check_interval,
        ai: AiSettings {
            api_endpoint: settings.ai.api_endpoint,
            encrypted_api_key: if settings.ai.encrypted_api_key.is_empty() {
                "".to_string()
            } else {
                "***".to_string() // 隐藏加密后的密钥
            },
            model: settings.ai.model,
            custom_headers: settings.ai.custom_headers,
            timeout: settings.ai.timeout,
        },
    }
}

/// 获取解密后的 AI API Key（内部使用）
pub fn get_decrypted_api_key() -> String {
    let settings = read_settings();
    if settings.ai.encrypted_api_key.is_empty() {
        return "".to_string();
    }
    // 尝试解密，如果失败返回空字符串
    crate::git::decrypt_string(&settings.ai.encrypted_api_key).unwrap_or_default()
}

/// 更新全局设置
#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    timeout: u64,
    language: Option<String>,
    git_update_check_interval: Option<u64>,
    ai_api_endpoint: Option<String>,
    ai_api_key: Option<String>,
    ai_model: Option<String>,
    ai_custom_headers: Option<Vec<Header>>,
    ai_timeout: Option<u64>,
) -> Result<AppSettings, String> {
    let mut settings = read_settings();
    settings.request_timeout = timeout;
    if let Some(lang) = language {
        settings.language = lang;
    }
    if let Some(interval) = git_update_check_interval {
        settings.git_update_check_interval = interval;
    }
    if let Some(endpoint) = ai_api_endpoint {
        settings.ai.api_endpoint = endpoint;
    }
    if let Some(key) = ai_api_key {
        // null 表示前端没传（用户没输入），保持原值不变
        // 空字符串 "" 表示用户要清空
        // 有值表示用户输入了新值，加密保存
        if key.is_empty() {
            // 清空加密密钥
            settings.ai.encrypted_api_key = "".to_string();
        } else {
            // 加密保存新值
            let encrypted_key = encrypt_string(&key)?;
            settings.ai.encrypted_api_key = encrypted_key;
        }
    }
    if let Some(model) = ai_model {
        settings.ai.model = model;
    }
    if let Some(headers) = ai_custom_headers {
        settings.ai.custom_headers = headers;
    }
    if let Some(ai_timeout_val) = ai_timeout {
        settings.ai.timeout = ai_timeout_val;
    }
    write_settings(&settings)?;
    
    // 发送设置更新事件通知前端（返回隐藏值）
    let response_settings = AppSettings {
        request_timeout: settings.request_timeout,
        language: settings.language,
        git_update_check_interval: settings.git_update_check_interval,
        ai: AiSettings {
            api_endpoint: settings.ai.api_endpoint,
            encrypted_api_key: if settings.ai.encrypted_api_key.is_empty() {
                "".to_string()
            } else {
                "***".to_string()
            },
            model: settings.ai.model,
            custom_headers: settings.ai.custom_headers,
            timeout: settings.ai.timeout,
        },
    };
    app.emit("settings-updated", &response_settings).ok();
    
    Ok(response_settings)
}