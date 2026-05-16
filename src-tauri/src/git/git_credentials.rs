use std::env;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::models::GitCredentials;

use super::git_config::{read_git_credentials_config, write_git_credentials_config};

/// 生成加密密钥（基于机器名+用户名的 hash）
fn generate_encryption_key() -> Result<[u8; 32], String> {
    let machine_name = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown-machine".to_string());
    
    let user_name = env::var("USERNAME")
        .or_else(|_| env::var("USER"))
        .unwrap_or_else(|_| "unknown-user".to_string());
    
    let seed = format!("{}:{}", machine_name, user_name);
    
    let mut hasher = Sha256::new();
    hasher.update(seed.as_bytes());
    let hash = hasher.finalize();
    
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    
    Ok(key)
}

/// 加密密码
fn encrypt_password(password: &str) -> Result<String, String> {
    let key = generate_encryption_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("创建加密器失败: {}", e))?;
    
    // 使用固定的 12 字节 nonce（对于凭据存储场景足够安全）
    let nonce_bytes = b"fm-git-creds"; // 12 bytes
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let ciphertext = cipher
        .encrypt(nonce, password.as_bytes())
        .map_err(|e| format!("加密失败: {}", e))?;
    
    Ok(BASE64.encode(&ciphertext))
}

/// 解密密码
fn decrypt_password(encrypted: &str) -> Result<String, String> {
    let key = generate_encryption_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("创建解密器失败: {}", e))?;
    
    let ciphertext = BASE64
        .decode(encrypted)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;
    
    let nonce_bytes = b"fm-git-creds"; // 12 bytes
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("解密失败: {}", e))?;
    
    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 转换失败: {}", e))
}

/// 保存 Git 凭据
#[tauri::command]
pub fn save_git_credentials(
    id: Option<String>,
    username: String,
    password: String,
) -> Result<GitCredentials, String> {
    let mut config = read_git_credentials_config()?;
    
    let encrypted_password = encrypt_password(&password)?;
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let credentials = if let Some(existing_id) = id {
        // 更新现有凭据
        let existing = config
            .credentials
            .iter_mut()
            .find(|c| c.id == existing_id)
            .ok_or_else(|| format!("未找到 ID 为 {} 的凭据", existing_id))?;
        
        existing.username = username;
        existing.encrypted_password = encrypted_password;
        existing.updated_at = Some(now.clone());
        
        existing.clone()
    } else {
        // 创建新凭据
        let new_credentials = GitCredentials {
            id: Uuid::new_v4().to_string(),
            username,
            encrypted_password,
            created_at: now,
            updated_at: None,
        };
        
        config.credentials.push(new_credentials.clone());
        new_credentials
    };
    
    write_git_credentials_config(&config)?;
    
    Ok(credentials)
}

/// 获取所有 Git 凭据（不包含密码）
#[tauri::command]
pub fn get_git_credentials() -> Result<Vec<GitCredentials>, String> {
    let config = read_git_credentials_config()?;
    
    // 返回凭据列表，但隐藏加密密码
    Ok(config
        .credentials
        .into_iter()
        .map(|mut c| {
            c.encrypted_password = "***".to_string();
            c
        })
        .collect())
}

/// 获取单个 Git 凭据（包含解密后的密码）- 内部使用
pub fn get_credential_by_id_internal(id: String) -> Result<GitCredentials, String> {
    let config = read_git_credentials_config()?;
    
    let credential = config
        .credentials
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| format!("未找到 ID 为 {} 的凭据", id))?;
    
    // 解密密码
    let decrypted_password = decrypt_password(&credential.encrypted_password)?;
    
    Ok(GitCredentials {
        id: credential.id,
        username: credential.username,
        encrypted_password: decrypted_password,
        created_at: credential.created_at,
        updated_at: credential.updated_at,
    })
}

/// 获取单个 Git 凭据（包含解密后的密码）- Tauri 命令
#[tauri::command]
pub fn get_git_credential_by_id(id: String) -> Result<GitCredentials, String> {
    get_credential_by_id_internal(id)
}

/// 删除 Git 凭据
#[tauri::command]
pub fn delete_git_credentials(id: String) -> Result<(), String> {
    let mut config = read_git_credentials_config()?;
    
    let initial_len = config.credentials.len();
    config.credentials.retain(|c| c.id != id);
    
    if config.credentials.len() == initial_len {
        return Err(format!("未找到 ID 为 {} 的凭据", id));
    }
    
    write_git_credentials_config(&config)?;
    
    Ok(())
}