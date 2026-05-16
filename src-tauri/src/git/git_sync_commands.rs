use chrono::Local;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};
use crate::workspace::{read_config, write_config};
use crate::git::get_credential_by_id_internal;

/// Git 同步日志结构
#[derive(Clone, Serialize)]
struct GitSyncLog {
    #[serde(rename = "logType")]
    log_type: String,
    timestamp: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// 发送日志事件
fn emit_log(app: &AppHandle, log: GitSyncLog) {
    if let Err(e) = app.emit("git-sync-log", log) {
        eprintln!("发送 Git 同步日志事件失败: {}", e);
    }
}

/// 检查路径是否是 git 仓库
fn is_git_repo(path: &str) -> bool {
    Path::new(path).join(".git").exists()
}

/// 执行 git 命令并返回输出
fn run_git_command(args: Vec<&str>, working_dir: Option<&str>) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(&args);

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    let output = cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "系统未安装 git 命令，请先安装 Git".to_string()
        } else {
            format!("执行 git 命令失败: {}", e)
        }
    })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Git 命令执行失败".to_string()
        } else {
            stderr
        })
    }
}

/// 同步工作区到 Git 仓库（推送本地 collections.yaml）
#[tauri::command]
pub async fn sync_git_workspace(
    app: AppHandle,
    workspace_id: String,
    commit_message: Option<String>,
) -> Result<(), String> {
    // 从配置中获取工作区信息
    let config = read_config();
    let workspace = config
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .cloned()
        .ok_or_else(|| "工作区不存在".to_string())?;
    
    // 检查是否是 Git 工作区
    if workspace.workspace_type != "git" {
        return Err("此工作区不是 Git 类型".to_string());
    }
    
    let workspace_path = workspace.path;
    let repo_url = workspace.git_url.clone().unwrap_or_default();
    
    // 获取凭据（如果有）
    let (username, password) = if let Some(cred_id) = &workspace.git_credentials_id {
        let cred = get_credential_by_id_internal(cred_id.clone())?;
        (Some(cred.username), Some(cred.encrypted_password))
    } else {
        (None, None)
    };
    
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "开始同步工作区到 Git 仓库".to_string(),
            data: Some(serde_json::json!({
                "workspacePath": workspace_path,
                "repoUrl": repo_url
            })),
            error: None,
        },
    );

    // 检查是否是 git 仓库
    if !is_git_repo(&workspace_path) {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "工作区路径不是 Git 仓库，开始克隆".to_string(),
                data: None,
                error: None,
            },
        );

        // 确保父目录存在（git clone 会自动创建目标目录）
        let parent_dir = Path::new(&workspace_path).parent();
        if let Some(parent) = parent_dir {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建父目录失败: {}", e))?;
            }
        }

        // 构建带认证的 URL
        // 首先提取纯净的 URL（去除已有的认证信息）
        let clean_url = if repo_url.starts_with("https://") {
            let after_protocol = &repo_url[8..];
            // 如果 URL 中已包含 @，提取 @ 之后的部分
            if let Some(at_pos) = after_protocol.find('@') {
                after_protocol[at_pos + 1..].to_string()
            } else {
                after_protocol.to_string()
            }
        } else if repo_url.starts_with("http://") {
            let after_protocol = &repo_url[7..];
            if let Some(at_pos) = after_protocol.find('@') {
                after_protocol[at_pos + 1..].to_string()
            } else {
                after_protocol.to_string()
            }
        } else if repo_url.starts_with("git@") {
            // SSH 格式: git@github.com:user/repo.git -> 保持原样
            repo_url.clone()
        } else {
            repo_url.clone()
        };
        
        // URL 编码用户名和密码（邮箱中的 @ 需要编码为 %40）
        fn url_encode(s: &str) -> String {
            s.replace('@', "%40")
              .replace(':', "%3A")
              .replace('/', "%2F")
              .replace(' ', "%20")
        }
        
        // 构建带认证的 URL（仅在 HTTPS/HTTP 时添加认证）
        let auth_url = if let (Some(user), Some(pass)) = (username.clone(), password.clone()) {
            if repo_url.starts_with("https://") && !user.is_empty() && !pass.is_empty() {
                let encoded_user = url_encode(&user);
                let encoded_pass = url_encode(&pass);
                format!("https://{}:{}@{}", encoded_user, encoded_pass, clean_url)
            } else if repo_url.starts_with("http://") && !user.is_empty() && !pass.is_empty() {
                let encoded_user = url_encode(&user);
                let encoded_pass = url_encode(&pass);
                format!("http://{}:{}@{}", encoded_user, encoded_pass, clean_url)
            } else {
                format!("https://{}", clean_url)
            }
        } else {
            if repo_url.starts_with("https://") {
                format!("https://{}", clean_url)
            } else if repo_url.starts_with("http://") {
                format!("http://{}", clean_url)
            } else {
                repo_url.clone()
            }
        };

        // 克隆仓库（直接 clone 到目标路径）
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: format!("正在克隆仓库: {}", repo_url),
                data: None,
                error: None,
            },
        );

        let clone_result = run_git_command(vec!["clone", &auth_url, &workspace_path], None);
        if let Err(e) = clone_result {
            let err_msg = format!("克隆仓库失败: {}", e);
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "error".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: err_msg.clone(),
                    data: None,
                    error: Some(err_msg.clone()),
                },
            );
            return Err(err_msg);
        }

        emit_log(
            &app,
            GitSyncLog {
                log_type: "success".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "仓库克隆成功".to_string(),
                data: None,
                error: None,
            },
        );
    } else {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "工作区已是 Git 仓库，开始同步更改".to_string(),
                data: None,
                error: None,
            },
        );
    }

    // 检查 collections.yaml 是否存在，不存在则创建空的
    let collections_file = Path::new(&workspace_path).join("collections.yaml");
    if !collections_file.exists() {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "创建空的 collections.yaml 文件".to_string(),
                data: None,
                error: None,
            },
        );
        
        // 创建空的 collections.yaml
        let empty_collections = "collections: []\n";
        fs::write(&collections_file, empty_collections)
            .map_err(|e| format!("创建 collections.yaml 失败: {}", e))?;
    }

    // 配置 Git 用户信息
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "配置 Git 用户信息".to_string(),
            data: None,
            error: None,
        },
    );

    let _ = run_git_command(vec!["config", "user.name", "FM Tester"], Some(&workspace_path));
    let _ = run_git_command(vec!["config", "user.email", "fm-tester@example.com"], Some(&workspace_path));

    // Git add 所有 yaml 文件（包括子目录）
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "添加所有配置文件到 Git".to_string(),
            data: None,
            error: None,
        },
    );

    // 添加所有文件（包括子目录中的 yaml 文件）
    // history/ 和 saved_responses/ 子目录中的 yaml 也会被添加
    let add_result = run_git_command(vec!["add", "."], Some(&workspace_path));
    if let Err(e) = add_result {
        let err_msg = format!("Git add 失败: {}", e);
        emit_log(
            &app,
            GitSyncLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: err_msg.clone(),
                data: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    // 检查是否有更改需要提交
    let status_result = run_git_command(vec!["status", "--porcelain"], Some(&workspace_path));
    if let Ok(status) = status_result {
        if status.is_empty() {
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "info".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: "没有更改需要提交".to_string(),
                    data: None,
                    error: None,
                },
            );
            // 即使没有更改，也更新同步时间
            let mut config = read_config();
            let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            for w in &mut config.workspaces {
                if w.id == workspace_id {
                    w.last_sync_at = Some(now);
                    break;
                }
            }
            write_config(&config)?;
            return Ok(());
        }
    }

    // Git commit
    let message = commit_message.unwrap_or_else(|| "Update collections.yaml".to_string());
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: format!("提交更改: {}", message),
            data: None,
            error: None,
        },
    );

    let commit_result = run_git_command(vec!["commit", "-m", &message], Some(&workspace_path));
    if let Err(e) = commit_result {
        if e.contains("nothing to commit") {
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "info".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: "没有更改需要提交".to_string(),
                    data: None,
                    error: None,
                },
            );
            return Ok(());
        }
        let err_msg = format!("Git commit 失败: {}", e);
        emit_log(
            &app,
            GitSyncLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: err_msg.clone(),
                data: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    // Git push
    emit_log(
        &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "推送到远程仓库".to_string(),
                data: None,
                error: None,
            },
        );

    // 如果提供了凭据，设置远程 URL
    if let (Some(user), Some(pass)) = (username, password) {
        let remote_url_result = run_git_command(vec!["remote", "get-url", "origin"], Some(&workspace_path));
        if let Ok(current_url) = remote_url_result {
            // URL 编码
            let encoded_user = user.replace('@', "%40").replace(':', "%3A");
            let encoded_pass = pass.replace('@', "%40").replace(':', "%3A");
            
            // 清理已有认证信息
            let clean_url = if current_url.starts_with("https://") {
                let after = &current_url[8..];
                if let Some(at_pos) = after.find('@') {
                    after[at_pos + 1..].to_string()
                } else {
                    after.to_string()
                }
            } else if current_url.starts_with("http://") {
                let after = &current_url[7..];
                if let Some(at_pos) = after.find('@') {
                    after[at_pos + 1..].to_string()
                } else {
                    after.to_string()
                }
            } else {
                current_url.clone()
            };
            
            let auth_url = if current_url.starts_with("https://") {
                format!("https://{}:{}@{}", encoded_user, encoded_pass, clean_url)
            } else if current_url.starts_with("http://") {
                format!("http://{}:{}@{}", encoded_user, encoded_pass, clean_url)
            } else {
                clean_url
            };

            let _ = run_git_command(vec!["remote", "set-url", "origin", &auth_url], Some(&workspace_path));
        }
    }

    let push_result = run_git_command(vec!["push", "origin", "HEAD"], Some(&workspace_path));
    if let Err(e) = push_result {
        let err_msg = format!("Git push 失败: {}", e);
        emit_log(
            &app,
            GitSyncLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: err_msg.clone(),
                data: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    emit_log(
        &app,
        GitSyncLog {
            log_type: "success".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "工作区同步成功".to_string(),
            data: None,
            error: None,
        },
    );

    // 更新工作区的最新同步时间
    let mut config = read_config();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for w in &mut config.workspaces {
        if w.id == workspace_id {
            w.last_sync_at = Some(now);
            break;
        }
    }
    write_config(&config)?;

    Ok(())
}

/// 从 Git 仓库更新工作区（拉取 collections.yaml）
#[tauri::command]
pub async fn update_git_workspace(
    app: AppHandle,
    workspace_id: String,
) -> Result<(), String> {
    // 从配置中获取工作区信息
    let config = read_config();
    let workspace = config
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .cloned()
        .ok_or_else(|| "工作区不存在".to_string())?;
    
    // 检查是否是 Git 工作区
    if workspace.workspace_type != "git" {
        return Err("此工作区不是 Git 类型".to_string());
    }
    
    let workspace_path = workspace.path.clone();
    
    // 获取凭据（如果有）
    let (username, password) = if let Some(cred_id) = &workspace.git_credentials_id {
        let cred = get_credential_by_id_internal(cred_id.clone())?;
        (Some(cred.username), Some(cred.encrypted_password))
    } else {
        (None, None)
    };
    
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "开始从 Git 仓库更新工作区".to_string(),
            data: Some(serde_json::json!({
                "workspacePath": workspace_path
            })),
            error: None,
        },
    );

    // 检查工作区路径是否存在
    if !Path::new(&workspace_path).exists() {
        let err_msg = format!("工作区路径不存在: {}", workspace_path);
        emit_log(
            &app,
            GitSyncLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: err_msg.clone(),
                data: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    // 检查是否是 git 仓库
    if !is_git_repo(&workspace_path) {
        let err_msg = "工作区路径不是 Git 仓库，请先同步".to_string();
        emit_log(
            &app,
            GitSyncLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: err_msg.clone(),
                data: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    // 如果提供了凭据，设置远程 URL
    if let (Some(user), Some(pass)) = (username, password) {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "配置 Git 认证信息".to_string(),
                data: None,
                error: None,
            },
        );

        let remote_url_result = run_git_command(vec!["remote", "get-url", "origin"], Some(&workspace_path));
        if let Ok(current_url) = remote_url_result {
            // URL 编码
            let encoded_user = user.replace('@', "%40").replace(':', "%3A");
            let encoded_pass = pass.replace('@', "%40").replace(':', "%3A");
            
            // 清理已有认证信息
            let clean_url = if current_url.starts_with("https://") {
                let after = &current_url[8..];
                if let Some(at_pos) = after.find('@') {
                    after[at_pos + 1..].to_string()
                } else {
                    after.to_string()
                }
            } else if current_url.starts_with("http://") {
                let after = &current_url[7..];
                if let Some(at_pos) = after.find('@') {
                    after[at_pos + 1..].to_string()
                } else {
                    after.to_string()
                }
            } else {
                current_url.clone()
            };
            
            let auth_url = if current_url.starts_with("https://") {
                format!("https://{}:{}@{}", encoded_user, encoded_pass, clean_url)
            } else if current_url.starts_with("http://") {
                format!("http://{}:{}@{}", encoded_user, encoded_pass, clean_url)
            } else {
                clean_url
            };

            let _ = run_git_command(vec!["remote", "set-url", "origin", &auth_url], Some(&workspace_path));
        }
    }

    // Git fetch
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "从远程仓库获取更新".to_string(),
            data: None,
            error: None,
        },
    );

    let fetch_result = run_git_command(vec!["fetch", "origin"], Some(&workspace_path));
    if let Err(e) = fetch_result {
        let err_msg = format!("Git fetch 失败: {}", e);
        emit_log(
            &app,
            GitSyncLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: err_msg.clone(),
                data: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    // 检查是否有冲突
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "检查本地更改状态".to_string(),
            data: None,
            error: None,
        },
    );

    let status_result = run_git_command(vec!["status", "--porcelain"], Some(&workspace_path));
    if let Ok(status) = status_result {
        if !status.is_empty() {
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "warning".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: "本地有未提交的更改，可能产生冲突".to_string(),
                    data: Some(serde_json::json!({
                        "status": status
                    })),
                    error: None,
                },
            );
        }
    }

    // Git pull
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "拉取远程更改".to_string(),
            data: None,
            error: None,
        },
    );

    let pull_result = run_git_command(vec!["pull", "origin", "HEAD"], Some(&workspace_path));
    if let Err(e) = pull_result {
        if e.contains("CONFLICT") || e.contains("conflict") {
            let err_msg = format!("拉取时发生冲突，请手动解决: {}", e);
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "error".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: err_msg.clone(),
                    data: Some(serde_json::json!({
                        "hasConflict": true
                    })),
                    error: Some(err_msg.clone()),
                },
            );
            return Err(err_msg);
        }

        let err_msg = format!("Git pull 失败: {}", e);
        emit_log(
            &app,
            GitSyncLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: err_msg.clone(),
                data: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    emit_log(
        &app,
        GitSyncLog {
            log_type: "success".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "工作区更新成功".to_string(),
            data: None,
            error: None,
        },
    );

    // 更新工作区的最新更新时间
    let mut config = read_config();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for w in &mut config.workspaces {
        if w.id == workspace_id {
            w.last_update_at = Some(now);
            break;
        }
    }
    write_config(&config)?;

    Ok(())
}

/// 同步 Git 工作区（先拉取再推送）
#[tauri::command]
pub async fn sync_git_workspace_full(
    app: AppHandle,
    workspace_id: String,
    commit_message: Option<String>,
) -> Result<(), String> {
    // 先拉取远程更改
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "开始同步：先拉取远程更改".to_string(),
            data: None,
            error: None,
        },
    );
    
    // 执行 pull
    {
        let config = read_config();
        let workspace = config
            .workspaces
            .iter()
            .find(|w| w.id == workspace_id)
            .cloned()
            .ok_or_else(|| "工作区不存在".to_string())?;
        
        if workspace.workspace_type != "git" {
            return Err("此工作区不是 Git 类型".to_string());
        }
        
        let workspace_path = workspace.path.clone();
        
        let (username, password) = if let Some(cred_id) = &workspace.git_credentials_id {
            let cred = get_credential_by_id_internal(cred_id.clone())?;
            (Some(cred.username), Some(cred.encrypted_password))
        } else {
            (None, None)
        };
        
        if is_git_repo(&workspace_path) {
            // 设置远程 URL
            if let (Some(user), Some(pass)) = (username.clone(), password.clone()) {
                let remote_url_result = run_git_command(vec!["remote", "get-url", "origin"], Some(&workspace_path));
                if let Ok(current_url) = remote_url_result {
                    let encoded_user = user.replace('@', "%40").replace(':', "%3A");
                    let encoded_pass = pass.replace('@', "%40").replace(':', "%3A");
                    
                    let clean_url = if current_url.starts_with("https://") {
                        let after = &current_url[8..];
                        if let Some(at_pos) = after.find('@') {
                            after[at_pos + 1..].to_string()
                        } else {
                            after.to_string()
                        }
                    } else if current_url.starts_with("http://") {
                        let after = &current_url[7..];
                        if let Some(at_pos) = after.find('@') {
                            after[at_pos + 1..].to_string()
                        } else {
                            after.to_string()
                        }
                    } else {
                        current_url.clone()
                    };
                    
                    let auth_url = if current_url.starts_with("https://") {
                        format!("https://{}:{}@{}", encoded_user, encoded_pass, clean_url)
                    } else if current_url.starts_with("http://") {
                        format!("http://{}:{}@{}", encoded_user, encoded_pass, clean_url)
                    } else {
                        clean_url
                    };
                    
                    let _ = run_git_command(vec!["remote", "set-url", "origin", &auth_url], Some(&workspace_path));
                }
            }
            
            // Git pull
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "info".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: "拉取远程更改".to_string(),
                    data: None,
                    error: None,
                },
            );
            
            let pull_result = run_git_command(vec!["pull", "origin", "HEAD"], Some(&workspace_path));
            if let Err(e) = pull_result {
                if e.contains("CONFLICT") || e.contains("conflict") {
                    let err_msg = format!("拉取时发生冲突: {}", e);
                    emit_log(
                        &app,
                        GitSyncLog {
                            log_type: "error".to_string(),
                            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                            message: err_msg.clone(),
                            data: None,
                            error: Some(err_msg.clone()),
                        },
                    );
                    return Err(err_msg);
                }
            }
        }
    }
    
    // 再推送本地更改
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "推送本地更改".to_string(),
            data: None,
            error: None,
        },
    );
    
    {
        let config = read_config();
        let workspace = config
            .workspaces
            .iter()
            .find(|w| w.id == workspace_id)
            .cloned()
            .ok_or_else(|| "工作区不存在".to_string())?;
        
        let workspace_path = workspace.path.clone();
        
        let (username, password) = if let Some(cred_id) = &workspace.git_credentials_id {
            let cred = get_credential_by_id_internal(cred_id.clone())?;
            (Some(cred.username), Some(cred.encrypted_password))
        } else {
            (None, None)
        };
        
        // 如果不是 git 仓库，先 clone
        if !is_git_repo(&workspace_path) {
            let repo_url = workspace.git_url.clone().unwrap_or_default();
            
            let parent_dir = Path::new(&workspace_path).parent();
            if let Some(parent) = parent_dir {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("创建父目录失败: {}", e))?;
                }
            }
            
            let clean_url = if repo_url.starts_with("https://") {
                let after = &repo_url[8..];
                if let Some(at_pos) = after.find('@') { after[at_pos + 1..].to_string() } else { after.to_string() }
            } else if repo_url.starts_with("http://") {
                let after = &repo_url[7..];
                if let Some(at_pos) = after.find('@') { after[at_pos + 1..].to_string() } else { after.to_string() }
            } else { repo_url.clone() };
            
            fn url_encode(s: &str) -> String {
                s.replace('@', "%40").replace(':', "%3A").replace('/', "%2F").replace(' ', "%20")
            }
            
            let auth_url = if let (Some(user), Some(pass)) = (username.clone(), password.clone()) {
                if repo_url.starts_with("https://") { format!("https://{}:{}@{}", url_encode(&user), url_encode(&pass), clean_url) }
                else if repo_url.starts_with("http://") { format!("http://{}:{}@{}", url_encode(&user), url_encode(&pass), clean_url) }
                else { format!("https://{}", clean_url) }
            } else { format!("https://{}", clean_url) };
            
            let _ = run_git_command(vec!["clone", &auth_url, &workspace_path], None);
        }
        
        // 配置 Git 用户
        let _ = run_git_command(vec!["config", "user.name", "FM Tester"], Some(&workspace_path));
        let _ = run_git_command(vec!["config", "user.email", "fm-tester@example.com"], Some(&workspace_path));
        
        // Git add
        let _ = run_git_command(vec!["add", "."], Some(&workspace_path));
        
        // Git commit（如果有更改）
        let status = run_git_command(vec!["status", "--porcelain"], Some(&workspace_path)).unwrap_or_default();
        if !status.is_empty() {
            let message = commit_message.unwrap_or_else(|| "Update".to_string());
            let _ = run_git_command(vec!["commit", "-m", &message], Some(&workspace_path));
        }
        
        // Git push
        if let (Some(user), Some(pass)) = (username, password) {
            let current_url = run_git_command(vec!["remote", "get-url", "origin"], Some(&workspace_path)).unwrap_or_default();
            let clean_url = if current_url.starts_with("https://") {
                let after = &current_url[8..];
                if let Some(at_pos) = after.find('@') { after[at_pos + 1..].to_string() } else { after.to_string() }
            } else if current_url.starts_with("http://") {
                let after = &current_url[7..];
                if let Some(at_pos) = after.find('@') { after[at_pos + 1..].to_string() } else { after.to_string() }
            } else { current_url.clone() };
            
            let auth_url = if current_url.starts_with("https://") {
                format!("https://{}:{}@{}", user.replace('@', "%40"), pass.replace('@', "%40"), clean_url)
            } else if current_url.starts_with("http://") {
                format!("http://{}:{}@{}", user.replace('@', "%40"), pass.replace('@', "%40"), clean_url)
            } else { clean_url };
            
            let _ = run_git_command(vec!["remote", "set-url", "origin", &auth_url], Some(&workspace_path));
        }
        
        let push_result = run_git_command(vec!["push", "origin", "HEAD"], Some(&workspace_path));
        if let Err(e) = push_result {
            return Err(format!("推送失败: {}", e));
        }
    }
    
    emit_log(
        &app,
        GitSyncLog {
            log_type: "success".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "同步完成".to_string(),
            data: None,
            error: None,
        },
    );
    
    // 更新同步时间
    let mut config = read_config();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for w in &mut config.workspaces {
        if w.id == workspace_id {
            w.last_sync_at = Some(now);
            break;
        }
    }
    write_config(&config)?;
    
    Ok(())
}