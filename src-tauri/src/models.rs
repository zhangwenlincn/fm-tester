use serde::{Deserialize, Serialize};

/// 工作区信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub created_at: String,
    pub last_opened: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_api_id: Option<String>,
}

/// 工作区配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub workspaces: Vec<Workspace>,
    pub last_workspace_id: Option<String>,
}

impl Default for WorkspaceConfig {
    fn default() -> Self {
        Self {
            workspaces: Vec::new(),
            last_workspace_id: None,
        }
    }
}

/// HTTP 请求头
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Header {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

/// 集合（可包含子集合和接口）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub item_type: String,  // "collection" 或 "api"
    pub children: Vec<Collection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<Vec<Header>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_type: Option<String>,
}

/// 集合配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CollectionsConfig {
    pub collections: Vec<Collection>,
}

/// 环境变量
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

/// 环境配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub id: String,
    pub name: String,
    pub variables: Vec<Variable>,
}

/// 环境配置文件结构（工作区级别）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EnvironmentsConfig {
    pub environments: Vec<Environment>,
    pub active_environment_id: Option<String>,
}

/// HTTP 响应结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: std::collections::HashMap<String, String>,
    pub body: String,
    pub time: u64,
    pub size: u64,
}