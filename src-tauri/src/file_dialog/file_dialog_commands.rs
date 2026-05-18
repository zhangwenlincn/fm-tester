use std::panic::catch_unwind;

/// 安全选择目录（捕获可能的 panic）
/// 使用 rfd crate 替代 tauri-plugin-dialog，避免新建文件夹时的崩溃
#[tauri::command]
pub async fn safe_pick_directory() -> Result<Option<String>, String> {
    // 在 spawn_blocking 中执行，这样可以捕获 panic
    let result = tokio::task::spawn_blocking(|| {
        catch_unwind(|| {
            // 使用 rfd 的同步 API（在阻塞线程中运行）
            rfd::FileDialog::new()
                .pick_folder()
        })
    }).await;
    
    match result {
        Ok(inner_result) => {
            match inner_result {
                Ok(path_option) => {
                    match path_option {
                        Some(path) => Ok(Some(path.to_string_lossy().to_string())),
                        None => Ok(None),
                    }
                }
                Err(_) => {
                    // 捕获到 panic，返回友好错误信息
                    Err("选择目录时发生错误，请先在文件管理器中创建文件夹后再选择".to_string())
                }
            }
        }
        Err(e) => Err(format!("任务执行失败: {}", e)),
    }
}