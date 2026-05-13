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

/// Form 表单字段（支持文本和文件）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormField {
    pub key: String,
    pub value: String,
    #[serde(rename = "type")]
    pub field_type: String, // "text" 或 "file"
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<FileInfo>>, // 文件类型时存储文件信息
}

/// 文件信息（仅保存路径）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
}

/// 集合（可包含子集合和接口）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub item_type: String, // "collection" 或 "api"
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub form_fields: Option<Vec<FormField>>, // form-data 字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binary_file_path: Option<String>, // binary 文件路径
    #[serde(skip_serializing_if = "Option::is_none")]
    pub saved_responses: Option<Vec<SavedResponseIndexEntry>>, // API 关联的保存响应索引
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

/// 工作区记忆配置（集合展开状态、打开的标签页）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryConfig {
    pub expanded_ids: Vec<String>,
    #[serde(default)]
    pub open_tabs: Vec<String>,      // 打开的标签页 API ID 列表
    #[serde(default)]
    pub active_tab_index: usize,     // 当前激活的标签页索引
    #[serde(default)]
    pub request_tabs: std::collections::HashMap<String, String>,  // 每个 API 的子标签页状态
}

/// Cookie 数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_age: Option<u64>,
    pub secure: bool,
    pub http_only: bool,
    pub created_at: String,
}

/// Cookie 存储配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CookiesConfig {
    pub cookies: Vec<Cookie>,
}

/// 保存的请求信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedRequest {
    pub method: String,
    pub url: String,           // 原始 URL（带变量 {{xxx}}）
    pub resolved_url: String,  // 替换变量后的实际 URL
    pub headers: Vec<Header>,
    pub body: Option<String>,
    pub body_type: Option<String>,
    pub form_fields: Option<Vec<FormField>>,
    pub binary_file_path: Option<String>,
}

/// 保存的响应数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedResponseData {
    pub status: u16,
    pub status_text: String,
    pub headers: std::collections::HashMap<String, String>,
    pub body: String,
    pub time: u64,
    pub size: u64,
}

/// 保存的响应（完整快照）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedResponse {
    pub id: String,
    pub name: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_id: Option<String>,  // 关联的 API ID
    pub request: SavedRequest,
    pub response: SavedResponseData,
    pub cookies: Vec<Cookie>,  // 请求时的 Cookie 快照
}

/// 响应索引条目（用于快速列出）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedResponseIndexEntry {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    pub status: u16,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_id: Option<String>,  // 关联的 API ID
}

/// 响应索引文件结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SavedResponsesIndex {
    pub responses: Vec<SavedResponseIndexEntry>,
}
