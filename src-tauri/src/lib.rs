mod collection;
mod environment;
mod http;
mod models;
mod workspace;

pub use collection::*;
pub use environment::*;
pub use http::*;
pub use models::*;
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
            // 集合
            get_collections,
            create_collection,
            create_api,
            update_api,
            delete_collection_item,
            update_collection,
            move_api,
            // 环境
            get_environments,
            save_environment,
            delete_environment,
            switch_environment,
            get_active_variables,
            // HTTP
            send_http_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
