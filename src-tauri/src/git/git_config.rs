use std::fs;
use std::path::PathBuf;

use crate::models::GitCredentialsConfig;

/// 获取 Git 凭据配置文件路径 (~/.fm/git_credentials.yaml)
pub fn get_git_credentials_config_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let fm_dir = home_dir.join(".fm");
    
    // 确保 .fm 目录存在
    if !fm_dir.exists() {
        fs::create_dir_all(&fm_dir)
            .map_err(|e| format!("创建 .fm 目录失败: {}", e))?;
    }
    
    Ok(fm_dir.join("git_credentials.yaml"))
}

/// 读取 Git 凭据配置
pub fn read_git_credentials_config() -> Result<GitCredentialsConfig, String> {
    let config_path = get_git_credentials_config_path()?;
    
    if !config_path.exists() {
        return Ok(GitCredentialsConfig::default());
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 Git 凭据配置失败: {}", e))?;
    
    let config: GitCredentialsConfig = serde_yaml::from_str(&content)
        .map_err(|e| format!("解析 Git 凭据配置失败: {}", e))?;
    
    Ok(config)
}

/// 写入 Git 凭据配置
pub fn write_git_credentials_config(config: &GitCredentialsConfig) -> Result<(), String> {
    let config_path = get_git_credentials_config_path()?;
    
    let content = serde_yaml::to_string(config)
        .map_err(|e| format!("序列化 Git 凭据配置失败: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("写入 Git 凭据配置失败: {}", e))?;
    
    Ok(())
}