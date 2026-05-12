mod commands;
mod config;
mod utils;

pub use commands::{
    delete_environment, get_active_variables, get_environments, save_environment,
    switch_environment,
};
pub use config::{
    get_environments_config_path, read_environments_config, write_environments_config,
};
pub use utils::replace_variables;
