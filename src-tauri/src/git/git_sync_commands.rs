use chrono::Local;
use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    BranchType, Cred, FetchOptions, PushOptions, RemoteCallbacks,
    Repository, Signature, Status, StatusOptions,
};
use serde::Serialize;
use std::fs;
use std::path::Path;
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pulled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pushed: Option<bool>,
}

/// 发送日志事件
fn emit_log(app: &AppHandle, log: GitSyncLog) {
    if let Err(e) = app.emit("git-sync-log", log) {
        eprintln!("发送 Git 同步日志事件失败: {}", e);
    }
}

/// 检查路径是否是 git 仓库
fn is_git_repo(path: &str) -> bool {
    Repository::open(path).is_ok()
}

/// 打开仓库，如果不存在则返回错误
fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| format!("打开仓库失败: {}", e))
}

/// 创建认证回调
fn create_remote_callbacks(username: &str, password: &str) -> RemoteCallbacks<'static> {
    let mut callbacks = RemoteCallbacks::new();
    let username = username.to_string();
    let password = password.to_string();
    
    callbacks.credentials(move |_url, _user_from_url, _allowed_types| {
        Cred::userpass_plaintext(&username, &password)
    });
    
    callbacks
}

/// 创建不带认证的回调
fn create_remote_callbacks_no_auth() -> RemoteCallbacks<'static> {
    RemoteCallbacks::new()
}

/// 配置 Git 用户信息
fn configure_git_user(repo: &Repository) -> Result<(), String> {
    let mut config = repo.config().map_err(|e| format!("获取配置失败: {}", e))?;
    config.set_str("user.name", "FM Tester").map_err(|e| format!("设置 user.name 失败: {}", e))?;
    config.set_str("user.email", "fm-tester@example.com").map_err(|e| format!("设置 user.email 失败: {}", e))?;
    Ok(())
}

/// 获取签名（从 config 或默认）
fn get_signature(repo: &Repository) -> Result<Signature<'static>, String> {
    repo.signature()
        .or_else(|_| Signature::now("FM Tester", "fm-tester@example.com"))
        .map_err(|e| format!("获取签名失败: {}", e))
}

/// Git add 所有文件
fn git_add_all(repo: &Repository) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("获取 index 失败: {}", e))?;
    
    // 添加所有文件
    index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("添加文件失败: {}", e))?;
    
    // 写入 index
    index.write().map_err(|e| format!("写入 index 失败: {}", e))?;
    Ok(())
}

/// 检查是否有未提交的更改
fn has_changes(repo: &Repository) -> Result<bool, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .include_ignored(false)
        .recurse_untracked_dirs(true);
    
    let statuses = repo.statuses(Some(&mut opts))
        .map_err(|e| format!("获取 status 失败: {}", e))?;
    
    for entry in statuses.iter() {
        let status = entry.status();
        // 检查是否有任何更改（新文件、修改、删除等）
        if status.contains(Status::INDEX_NEW) 
            || status.contains(Status::INDEX_MODIFIED)
            || status.contains(Status::INDEX_DELETED)
            || status.contains(Status::WT_NEW)
            || status.contains(Status::WT_MODIFIED)
            || status.contains(Status::WT_DELETED)
            || status.contains(Status::WT_RENAMED)
            || status.contains(Status::WT_TYPECHANGE)
        {
            return Ok(true);
        }
    }
    Ok(false)
}

/// 创建 commit
fn git_commit(repo: &Repository, message: &str) -> Result<git2::Oid, String> {
    let sig = get_signature(repo)?;
    
    // 获取 tree
    let mut index = repo.index().map_err(|e| format!("获取 index 失败: {}", e))?;
    let tree_id = index.write_tree().map_err(|e| format!("写入 tree 失败: {}", e))?;
    let tree = repo.find_tree(tree_id).map_err(|e| format!("查找 tree 失败: {}", e))?;
    
    // 获取父 commit
    let parent_commit = repo.head()
        .and_then(|head| head.peel_to_commit())
        .map_err(|e| format!("获取 HEAD commit 失败: {}", e))?;
    
    // 创建 commit
    let commit_id = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        message,
        &tree,
        &[&parent_commit]
    ).map_err(|e| format!("创建 commit 失败: {}", e))?;
    
    Ok(commit_id)
}

/// Clone 仓库（带认证）
fn git_clone_with_auth(
    url: &str,
    path: &str,
    username: Option<&str>,
    password: Option<&str>,
    branch: Option<&str>,
) -> Result<Repository, String> {
    let callbacks = if let (Some(user), Some(pass)) = (username, password) {
        create_remote_callbacks(user, pass)
    } else {
        create_remote_callbacks_no_auth()
    };
    
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);
    
    let mut builder = RepoBuilder::new();
    builder.fetch_options(fetch_opts);
    
    if let Some(b) = branch {
        builder.branch(b);
    }
    
    builder.clone(url, Path::new(path))
        .map_err(|e| format!("克隆仓库失败: {}", e))
}

/// Fetch 远程数据
fn git_fetch(repo: &Repository, remote_name: &str, username: Option<&str>, password: Option<&str>) -> Result<(), String> {
    let mut remote = repo.find_remote(remote_name)
        .map_err(|e| format!("查找 remote 失败: {}", e))?;
    
    let callbacks = if let (Some(user), Some(pass)) = (username, password) {
        create_remote_callbacks(user, pass)
    } else {
        create_remote_callbacks_no_auth()
    };
    
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);
    
    // 使用空字符串数组作为 refspecs
    let refspecs: &[&str] = &[];
    remote.fetch(refspecs, Some(&mut fetch_opts), None)
        .map_err(|e| format!("Fetch 失败: {}", e))?;
    
    Ok(())
}

/// Push 到远程
fn git_push(repo: &Repository, branch: &str, username: Option<&str>, password: Option<&str>) -> Result<(), String> {
    let mut remote = repo.find_remote("origin")
        .map_err(|e| format!("查找 remote 失败: {}", e))?;
    
    let mut callbacks = if let (Some(user), Some(pass)) = (username, password) {
        create_remote_callbacks(user, pass)
    } else {
        create_remote_callbacks_no_auth()
    };
    
    callbacks.push_update_reference(|_refname, status| {
        if let Some(s) = status {
            return Err(git2::Error::from_str(&format!("Push failed: {}", s)));
        }
        Ok(())
    });
    
    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);
    
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    remote.push(&[&refspec], Some(&mut push_opts))
        .map_err(|e| format!("Push 失败: {}", e))?;
    
    Ok(())
}

/// Pull（fetch + merge）
fn git_pull(repo: &Repository, branch: &str, username: Option<&str>, password: Option<&str>) -> Result<bool, String> {
    // 1. Fetch
    let mut remote = repo.find_remote("origin")
        .map_err(|e| format!("查找 remote 失败: {}", e))?;
    
    let callbacks = if let (Some(user), Some(pass)) = (username, password) {
        create_remote_callbacks(user, pass)
    } else {
        create_remote_callbacks_no_auth()
    };
    
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);
    
    remote.fetch(&[branch], Some(&mut fetch_opts), None)
        .map_err(|e| format!("Fetch 失败: {}", e))?;
    
    // 2. 获取 fetch commit
    let fetch_head = repo.find_reference("FETCH_HEAD")
        .map_err(|e| format!("查找 FETCH_HEAD 失败: {}", e))?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)
        .map_err(|e| format!("获取 fetch commit 失败: {}", e))?;
    
    // 3. Merge 分析
    let analysis = repo.merge_analysis(&[&fetch_commit])
        .map_err(|e| format!("Merge 分析失败: {}", e))?;
    
    if analysis.0.is_fast_forward() {
        // Fast-forward merge
        let refname = format!("refs/heads/{}", branch);
        let mut reference = repo.find_reference(&refname)
            .map_err(|e| format!("查找分支引用失败: {}", e))?;
        
        let target_id = fetch_commit.id();
        reference.set_target(target_id, "Fast-forward")
            .map_err(|e| format!("设置引用目标失败: {}", e))?;
        
        repo.set_head(&refname)
            .map_err(|e| format!("设置 HEAD 失败: {}", e))?;
        
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.force();
        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| format!("Checkout HEAD 失败: {}", e))?;
        
        Ok(true) // 有更新
    } else if analysis.0.is_normal() {
        // Normal merge - 需要处理冲突
        // 检查是否有冲突
        if analysis.0.is_up_to_date() {
            return Ok(false); // 无更新
        }
        
        // 执行 merge
        repo.merge(&[&fetch_commit], None, None)
            .map_err(|e| format!("Merge 失败: {}", e))?;
        
        // 检查是否有冲突
        let mut index = repo.index()
            .map_err(|e| format!("获取 index 失败: {}", e))?;
        
        if index.has_conflicts() {
            return Err("拉取时发生冲突，请手动解决".to_string());
        }
        
        // 创建 merge commit
        let sig = get_signature(repo)?;
        let tree_id = index.write_tree()
            .map_err(|e| format!("写入 tree 失败: {}", e))?;
        let tree = repo.find_tree(tree_id)
            .map_err(|e| format!("查找 tree 失败: {}", e))?;
        
        let head_commit = repo.head()
            .and_then(|head| head.peel_to_commit())
            .map_err(|e| format!("获取 HEAD commit 失败: {}", e))?;
        
        let fetch_commit_obj = repo.find_commit(fetch_commit.id())
            .map_err(|e| format!("查找 fetch commit 失败: {}", e))?;
        
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Merge remote changes",
            &tree,
            &[&head_commit, &fetch_commit_obj]
        ).map_err(|e| format!("创建 merge commit 失败: {}", e))?;
        
        // 清理 merge 状态
        repo.cleanup_state()
            .map_err(|e| format!("清理 merge 状态失败: {}", e))?;
        
        Ok(true) // 有更新
    } else if analysis.0.is_up_to_date() {
        Ok(false) // 无更新
    } else {
        Err("无法处理的 merge 情况".to_string())
    }
}

/// 设置 remote URL
fn set_remote_url(repo: &Repository, remote_name: &str, url: &str) -> Result<(), String> {
    repo.remote_set_url(remote_name, url)
        .map_err(|e| format!("设置 remote URL 失败: {}", e))?;
    Ok(())
}

/// 获取当前分支名
fn get_current_branch_name(repo: &Repository) -> String {
    repo.head()
        .ok()
        .and_then(|head| head.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "main".to_string())
}

/// 获取 remote URL
fn get_remote_url(repo: &Repository, remote_name: &str) -> Result<String, String> {
    let remote = repo.find_remote(remote_name)
        .map_err(|e| format!("查找 remote 失败: {}", e))?;
    
    let url = remote.url()
        .ok_or_else(|| "Remote 没有 URL".to_string())?;
    
    Ok(url.to_string())
}

/// 清理 URL 中的认证信息
fn clean_auth_from_url(url: &str) -> String {
    if url.starts_with("https://") {
        let after = &url[8..];
        if let Some(at_pos) = after.find('@') {
            format!("https://{}", &after[at_pos + 1..])
        } else {
            url.to_string()
        }
    } else if url.starts_with("http://") {
        let after = &url[7..];
        if let Some(at_pos) = after.find('@') {
            format!("http://{}", &after[at_pos + 1..])
        } else {
            url.to_string()
        }
    } else {
        url.to_string()
    }
}

/// 构建带认证的 URL
fn build_auth_url(url: &str, username: &str, password: &str) -> String {
    fn url_encode(s: &str) -> String {
        s.replace('@', "%40")
            .replace(':', "%3A")
            .replace('/', "%2F")
            .replace(' ', "%20")
    }
    
    let clean_url = clean_auth_from_url(url);
    let encoded_user = url_encode(username);
    let encoded_pass = url_encode(password);
    
    if url.starts_with("https://") {
        format!("https://{}:{}@{}", encoded_user, encoded_pass, clean_auth_from_url(&clean_url))
    } else if url.starts_with("http://") {
        format!("http://{}:{}@{}", encoded_user, encoded_pass, clean_auth_from_url(&clean_url))
    } else {
        clean_url
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
            pulled: None,
            pushed: None,
        },
    );

    // 检查是否是 git 仓库
    let repo = if !is_git_repo(&workspace_path) {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "工作区路径不是 Git 仓库，开始克隆".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
            },
        );

        // 确保父目录存在
        let parent_dir = Path::new(&workspace_path).parent();
        if let Some(parent) = parent_dir {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建父目录失败: {}", e))?;
            }
        }

        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: format!("正在克隆仓库: {}", repo_url),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
            },
        );

        // 克隆仓库
        let repo = git_clone_with_auth(
            &repo_url,
            &workspace_path,
            username.as_deref(),
            password.as_deref(),
            workspace.git_branch.as_deref(),
        );
        
        match repo {
            Ok(r) => {
                emit_log(
                    &app,
                    GitSyncLog {
                        log_type: "success".to_string(),
                        timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                        message: "仓库克隆成功".to_string(),
                        data: None,
                        error: None,
                        pulled: None,
                        pushed: None,
                    },
                );
                r
            }
            Err(e) => {
                emit_log(
                    &app,
                    GitSyncLog {
                        log_type: "error".to_string(),
                        timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                        message: e.clone(),
                        data: None,
                        error: Some(e.clone()),
                        pulled: None,
                        pushed: None,
                    },
                );
                return Err(e);
            }
        }
    } else {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "工作区已是 Git 仓库，开始同步更改".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
            },
        );
        open_repo(&workspace_path)?
    };

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
                pulled: None,
                pushed: None,
            },
        );
        
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
            pulled: None,
            pushed: None,
        },
    );
    configure_git_user(&repo)?;

    // Git add 所有文件
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "添加所有配置文件到 Git".to_string(),
            data: None,
            error: None,
            pulled: None,
            pushed: None,
        },
    );
    git_add_all(&repo)?;

    // 检查是否有更改需要提交
    if !has_changes(&repo)? {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "没有更改需要提交".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
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
            pulled: None,
            pushed: None,
        },
    );
    git_commit(&repo, &message)?;

    // 设置 remote URL（如果有凭据）
    if let (Some(user), Some(pass)) = (&username, &password) {
        let current_url = get_remote_url(&repo, "origin").ok();
        if let Some(url) = current_url {
            let auth_url = build_auth_url(&url, user, pass);
            set_remote_url(&repo, "origin", &auth_url)?;
        }
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
            pulled: None,
            pushed: None,
        },
    );

// 获取当前分支名
    let branch = get_current_branch_name(&repo);
    
    git_push(&repo, &branch, username.as_deref(), password.as_deref())?;

    emit_log(
        &app,
        GitSyncLog {
            log_type: "success".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "工作区同步成功".to_string(),
            data: None,
            error: None,
            pulled: None,
            pushed: None,
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
            pulled: None,
            pushed: None,
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
                pulled: None,
                pushed: None,
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
                pulled: None,
                pushed: None,
            },
        );
        return Err(err_msg);
    }

    let repo = open_repo(&workspace_path)?;

    // 设置 remote URL（如果有凭据）
    if let (Some(user), Some(pass)) = (&username, &password) {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "配置 Git 认证信息".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
            },
        );

        let current_url = get_remote_url(&repo, "origin").ok();
        if let Some(url) = current_url {
            let auth_url = build_auth_url(&url, user, pass);
            set_remote_url(&repo, "origin", &auth_url)?;
        }
    }

    // 获取当前分支
    let branch = get_current_branch_name(&repo);

    // Git fetch
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "从远程仓库获取更新".to_string(),
            data: None,
            error: None,
            pulled: None,
            pushed: None,
        },
    );
    git_fetch(&repo, "origin", username.as_deref(), password.as_deref())?;

    // 检查是否有本地更改
    if has_changes(&repo)? {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "warning".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "本地有未提交的更改，可能产生冲突".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
            },
        );
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
            pulled: None,
            pushed: None,
        },
    );
    
    let result = git_pull(&repo, &branch, username.as_deref(), password.as_deref());
    match result {
        Ok(_) => {
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "success".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: "工作区更新成功".to_string(),
                    data: None,
                    error: None,
                    pulled: None,
                    pushed: None,
                },
            );
        }
        Err(e) => {
            emit_log(
                &app,
                GitSyncLog {
                    log_type: "error".to_string(),
                    timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                    message: e.clone(),
                    data: None,
                    error: Some(e.clone()),
                    pulled: None,
                    pushed: None,
                },
            );
            return Err(e);
        }
    }

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
    let mut pulled = false;
    let mut pushed = false;
    
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "开始同步：先拉取远程更改".to_string(),
            data: None,
            error: None,
            pulled: None,
            pushed: None,
        },
    );
    
    // 从配置中获取工作区信息
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
    
    // 如果是 git 仓库，先 pull
    if is_git_repo(&workspace_path) {
        let repo = open_repo(&workspace_path)?;
        
        // 设置 remote URL
        if let (Some(user), Some(pass)) = (&username, &password) {
            let current_url = get_remote_url(&repo, "origin").ok();
            if let Some(url) = current_url {
                let auth_url = build_auth_url(&url, user, pass);
                set_remote_url(&repo, "origin", &auth_url)?;
            }
        }
        
        let branch = get_current_branch_name(&repo);
        
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "拉取远程更改".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
            },
        );
        
        let pull_result = git_pull(&repo, &branch, username.as_deref(), password.as_deref());
        match pull_result {
            Ok(has_update) => {
                pulled = has_update;
                if has_update {
                    emit_log(
                        &app,
                        GitSyncLog {
                            log_type: "info".to_string(),
                            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                            message: "拉取远程更改成功".to_string(),
                            data: None,
                            error: None,
                            pulled: Some(true),
                            pushed: None,
                        },
                    );
                } else {
                    emit_log(
                        &app,
                        GitSyncLog {
                            log_type: "info".to_string(),
                            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                            message: "远程无新更改".to_string(),
                            data: None,
                            error: None,
                            pulled: Some(false),
                            pushed: None,
                        },
                    );
                }
            }
            Err(e) => {
                emit_log(
                    &app,
                    GitSyncLog {
                        log_type: "error".to_string(),
                        timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                        message: e.clone(),
                        data: None,
                        error: Some(e.clone()),
                        pulled: None,
                        pushed: None,
                    },
                );
                return Err(e);
            }
        }
    }
    
    // 推送本地更改
    emit_log(
        &app,
        GitSyncLog {
            log_type: "info".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: "推送本地更改".to_string(),
            data: None,
            error: None,
            pulled: None,
            pushed: None,
        },
    );
    
    // 获取仓库（可能刚 clone）
    let repo = if is_git_repo(&workspace_path) {
        open_repo(&workspace_path)?
    } else {
        // 需要先 clone
        let repo_url = workspace.git_url.clone().unwrap_or_default();
        
        let parent_dir = Path::new(&workspace_path).parent();
        if let Some(parent) = parent_dir {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建父目录失败: {}", e))?;
            }
        }
        
        git_clone_with_auth(
            &repo_url,
            &workspace_path,
            username.as_deref(),
            password.as_deref(),
            workspace.git_branch.as_deref(),
        )?
    };
    
    // 配置 Git 用户
    configure_git_user(&repo)?;
    
    // Git add
    git_add_all(&repo)?;
    
    // 检查是否有更改
    if has_changes(&repo)? {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "提交本地更改".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: None,
            },
        );
        
        let message = commit_message.unwrap_or_else(|| "Update".to_string());
        git_commit(&repo, &message)?;
        pushed = true;
    } else {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "本地没有更改需要提交".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: Some(false),
            },
        );
    }
    
    // 设置 remote URL 并 push
    if let (Some(user), Some(pass)) = (&username, &password) {
        let current_url = get_remote_url(&repo, "origin").ok();
        if let Some(url) = current_url {
            let auth_url = build_auth_url(&url, user, pass);
            set_remote_url(&repo, "origin", &auth_url)?;
        }
    }
    
    let branch = get_current_branch_name(&repo);
    
    git_push(&repo, &branch, username.as_deref(), password.as_deref())?;
    
    if pushed {
        emit_log(
            &app,
            GitSyncLog {
                log_type: "info".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: "推送成功".to_string(),
                data: None,
                error: None,
                pulled: None,
                pushed: Some(true),
            },
        );
    }
    
    // 构建最终同步结果消息
    let final_message = if pulled && pushed {
        "已拉取远程更新并推送本地更改".to_string()
    } else if pulled && !pushed {
        "已拉取远程更新".to_string()
    } else if !pulled && pushed {
        "已推送本地更改".to_string()
    } else {
        "已是最新的，无需同步".to_string()
    };
    
    emit_log(
        &app,
        GitSyncLog {
            log_type: "success".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: final_message,
            data: Some(serde_json::json!({
                "pulled": pulled,
                "pushed": pushed
            })),
            error: None,
            pulled: Some(pulled),
            pushed: Some(pushed),
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

/// 检查 Git 工作区是否有远程更新（非阻塞）
#[tauri::command]
pub async fn check_git_updates(workspace_id: String) -> Result<bool, String> {
    let result = tokio::task::spawn_blocking(move || {
        let config = read_config();
        let workspace = config
            .workspaces
            .iter()
            .find(|w| w.id == workspace_id)
            .cloned()
            .ok_or_else(|| "工作区不存在".to_string())?;
        
        if workspace.workspace_type != "git" {
            return Ok(false);
        }
        
        let workspace_path = workspace.path.clone();
        
        if !is_git_repo(&workspace_path) {
            return Ok(false);
        }
        
        let repo = open_repo(&workspace_path)?;
        
        let (username, password) = if let Some(cred_id) = &workspace.git_credentials_id {
            let cred = get_credential_by_id_internal(cred_id.clone())?;
            (Some(cred.username), Some(cred.encrypted_password))
        } else {
            (None, None)
        };
        
        // 设置 remote URL
        if let (Some(user), Some(pass)) = (&username, &password) {
            let current_url = get_remote_url(&repo, "origin").ok();
            if let Some(url) = current_url {
                let auth_url = build_auth_url(&url, user, pass);
                set_remote_url(&repo, "origin", &auth_url)?;
            }
        }
        
        // Fetch
        git_fetch(&repo, "origin", username.as_deref(), password.as_deref())?;
        
        // 比较本地和远程 HEAD
        let local_head = repo.head()
            .ok()
            .and_then(|h| h.target())
            .ok_or_else(|| "获取本地 HEAD 失败".to_string())?;
        
        // 获取远程分支的 HEAD
        let branch = get_current_branch_name(&repo);
        
        let remote_ref_name = format!("refs/remotes/origin/{}", branch);
        let remote_head = repo.find_reference(&remote_ref_name)
            .ok()
            .and_then(|r| r.target())
            .ok_or_else(|| "获取远程 HEAD 失败".to_string())?;
        
        Ok(local_head != remote_head)
    }).await;
    
    result.map_err(|e| format!("任务执行失败: {}", e))?
}

/// 获取 Git 工作区的所有分支列表（远程分支）
#[tauri::command]
pub async fn get_git_branches(workspace_id: String) -> Result<Vec<String>, String> {
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
    
    if !is_git_repo(&workspace_path) {
        return Err("工作区路径不是 Git 仓库".to_string());
    }
    
    let repo = open_repo(&workspace_path)?;
    
    // 先 fetch 获取最新的远程分支信息
    let (username, password) = if let Some(cred_id) = &workspace.git_credentials_id {
        let cred = get_credential_by_id_internal(cred_id.clone())?;
        (Some(cred.username), Some(cred.encrypted_password))
    } else {
        (None, None)
    };
    
    git_fetch(&repo, "origin", username.as_deref(), password.as_deref()).ok();
    
    // 获取远程分支列表
    let branches = repo.branches(Some(BranchType::Remote))
        .map_err(|e| format!("获取分支列表失败: {}", e))?;
    
    let branch_names: Vec<String> = branches
        .filter_map(|branch_result| {
            branch_result.ok().and_then(|(branch, _)| {
                branch.name().ok().and_then(|name| {
                    name.filter(|n| {
                        // 过滤 origin/HEAD 和空名称
                        !n.starts_with("origin/HEAD") && !n.is_empty()
                    }).map(|n| {
                        // 去掉 origin/ 前缀
                        if n.starts_with("origin/") {
                            n[7..].to_string()
                        } else {
                            n.to_string()
                        }
                    })
                })
            })
        })
        .filter(|n| !n.is_empty())
        .collect();
    
    Ok(branch_names)
}

/// 获取当前分支
#[tauri::command]
pub async fn get_current_branch(workspace_id: String) -> Result<String, String> {
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
    
    if !is_git_repo(&workspace_path) {
        return Err("工作区路径不是 Git 仓库".to_string());
    }
    
    let repo = open_repo(&workspace_path)?;
    
    repo.head()
        .ok()
        .and_then(|head| head.shorthand().map(|s| s.to_string()))
        .ok_or_else(|| "获取当前分支失败".to_string())
}

/// 切换 Git 工作区的分支
#[tauri::command]
pub async fn switch_git_branch(workspace_id: String, branch: String) -> Result<(), String> {
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
    
    if !is_git_repo(&workspace_path) {
        return Err("工作区路径不是 Git 仓库".to_string());
    }
    
    let repo = open_repo(&workspace_path)?;
    
    // 检查是否有本地未提交的更改
    if has_changes(&repo)? {
        return Err("有未提交的更改，请先同步后再切换分支".to_string());
    }
    
    // 查找本地分支
    let local_branch = repo.find_branch(&branch, BranchType::Local);
    
    if let Ok(lb) = local_branch {
        // 本地分支存在，直接切换
        let refname = lb.into_reference().name().unwrap().to_string();
        repo.set_head(&refname)
            .map_err(|e| format!("设置 HEAD 失败: {}", e))?;
        
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.force();
        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| format!("Checkout 失败: {}", e))?;
    } else {
        // 本地分支不存在，从远程创建
        let remote_branch_name = format!("origin/{}", branch);
        let remote_branch = repo.find_branch(&remote_branch_name, BranchType::Remote)
            .map_err(|e| format!("远程分支不存在: {}", e))?;
        
        let remote_commit = remote_branch.into_reference()
            .peel_to_commit()
            .map_err(|e| format!("获取远程 commit 失败: {}", e))?;
        
        // 创建本地分支跟踪远程分支
        repo.branch(&branch, &remote_commit, false)
            .map_err(|e| format!("创建本地分支失败: {}", e))?;
        
        // 设置 HEAD 并 checkout
        let refname = format!("refs/heads/{}", branch);
        repo.set_head(&refname)
            .map_err(|e| format!("设置 HEAD 失败: {}", e))?;
        
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.force();
        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| format!("Checkout 失败: {}", e))?;
        
        // 设置 upstream
        let mut local_branch = repo.find_branch(&branch, BranchType::Local)
            .map_err(|e| format!("查找新创建的分支失败: {}", e))?;
        
        local_branch.set_upstream(Some(&format!("origin/{}", branch)))
            .map_err(|e| format!("设置 upstream 失败: {}", e))?;
    }
    
    // 更新工作区配置中的分支信息
    let mut config = read_config();
    for w in &mut config.workspaces {
        if w.id == workspace_id {
            w.git_branch = Some(branch.clone());
            break;
        }
    }
    write_config(&config)?;
    
    Ok(())
}