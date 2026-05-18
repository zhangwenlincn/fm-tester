mod ai;
mod chat;
mod collection;
mod cookie;
mod environment;
mod file_dialog;
mod git;
mod history;
mod http;
mod md;
mod memory;
mod models;
mod saved_response;
mod script;
mod settings;
mod workspace;

pub use ai::*;
pub use chat::*;
pub use collection::*;
pub use cookie::*;
pub use environment::*;
pub use file_dialog::*;
pub use git::*;
pub use history::*;
pub use http::*;
pub use md::*;
pub use memory::*;
pub use models::*;
pub use saved_response::*;
pub use script::*;
pub use settings::*;
pub use workspace::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // 工作区
            get_workspaces,
            get_last_workspace,
            create_workspace,
            switch_workspace,
            delete_workspace,
            update_workspace,
            set_last_workspace,
            set_last_api,
            get_last_api,
            reorder_workspaces,
            // 集合
            get_collections,
            create_collection,
            create_api,
            update_api,
            delete_collection_item,
            update_collection,
            update_collection_settings,
            move_api,
            move_collection,
            reorder_collection_items,
            // 环境
            get_environments,
            save_environment,
            delete_environment,
            switch_environment,
            get_active_variables,
            reorder_environments,
            // 记忆
            get_expanded_collections,
            save_expanded_collections,
            get_open_tabs,
            save_open_tabs,
            // HTTP
            send_http_request,
            // Cookie
            get_cookies,
            clear_cookies,
            delete_cookie,
            add_cookie,
            // Saved Response
            save_response,
            get_saved_responses,
            get_saved_response,
            delete_saved_response,
            get_api_saved_responses,
            // History
            get_history_dates,
            get_history_by_date,
            get_history_entry,
            delete_history_entry,
            clear_history_by_date,
            clear_all_history,
            // Settings
            get_settings,
            update_settings,
            // AI
            get_ai_models,
            chat_ai,
            optimize_script_ai,
            // Chat History
            save_chat_history,
            get_chat_history,
            clear_chat_history,
            get_chat_sessions,
            delete_chat_session,
            rename_chat_session,
            // Script
            save_script,
            get_script,
            delete_script,
            delete_target_scripts,
            get_all_scripts,
            // API Doc
            get_api_doc,
            save_api_doc,
            generate_api_doc_with_ai,
            get_doc_generation_status,
            cancel_doc_generation,
            get_api_doc_metadata,
            // Git Credentials
            save_git_credentials,
            get_git_credentials,
            get_git_credential_by_id,
            delete_git_credentials,
            // Git Sync
            sync_git_workspace,
            update_git_workspace,
            sync_git_workspace_full,
            check_git_updates,
            get_git_branches,
            get_current_branch,
            switch_git_branch,
            // File Dialog
            safe_pick_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
