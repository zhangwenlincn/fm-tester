use serde::{Deserialize, Serialize};

/// AI 设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSettings {
    /// API 端点地址（OpenAI 协议）
    #[serde(default = "default_ai_endpoint")]
    pub api_endpoint: String,
    /// API Key
    #[serde(default)]
    pub api_key: String,
    /// 选中的模型
    #[serde(default)]
    pub model: String,
    /// 自定义请求头
    #[serde(default)]
    pub custom_headers: Vec<Header>,
    /// AI 请求超时时间（秒），默认 600秒（10分钟）
    #[serde(default = "default_ai_timeout")]
    pub timeout: u64,
}

fn default_ai_endpoint() -> String {
    "https://api.openai.com/v1".to_string()
}

fn default_ai_timeout() -> u64 {
    600 // 默认 10 分钟
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            api_endpoint: "https://api.openai.com/v1".to_string(),
            api_key: "".to_string(),
            model: "".to_string(),
            custom_headers: Vec::new(),
            timeout: 600,
        }
    }
}

/// 全局应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// HTTP 请求超时时间（秒）
    #[serde(default = "default_timeout")]
    pub request_timeout: u64,
    /// 语言设置（zh-CN 或 en）
    #[serde(default = "default_language")]
    pub language: String,
    /// Git 工作区更新检查间隔（秒），0 表示禁用
    #[serde(default = "default_git_update_interval")]
    pub git_update_check_interval: u64,
    /// AI 设置
    #[serde(default)]
    pub ai: AiSettings,
}

fn default_timeout() -> u64 {
    60
}

fn default_language() -> String {
    "zh-CN".to_string()
}

fn default_git_update_interval() -> u64 {
    300 // 默认 300 秒（5 分钟）
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            request_timeout: 60,
            language: "zh-CN".to_string(),
            git_update_check_interval: 300,
            ai: AiSettings::default(),
        }
    }
}

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
    /// 工作区类型: "local" 或 "git"
    #[serde(default = "default_workspace_type")]
    pub workspace_type: String,
    /// Git 仓库 URL (仅 git 类型)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_url: Option<String>,
    /// Git 分支 (仅 git 类型)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    /// Git 凭据 ID (仅 git 类型)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_credentials_id: Option<String>,
    /// 最新同步时间 (仅 git 类型)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_at: Option<String>,
    /// 最新更新时间 (仅 git 类型)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_update_at: Option<String>,
}

fn default_workspace_type() -> String {
    "local".to_string()
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
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
    // 集合级别配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub common_headers: Option<Vec<Header>>, // 集合通用请求头
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_variables: Option<Vec<Variable>>, // 集合变量
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
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
    pub resolved_url: String, // 变量替换后的实际 URL
    pub resolved_headers: Vec<Header>, // 变量替换后的请求头
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
    pub headers: Vec<Header>,  // 原始请求头（带变量）
    pub resolved_headers: Vec<Header>, // 替换变量后的实际请求头
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

/// 历史记录条目（每次请求的完整记录）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub method: String,
    pub url: String,           // 原始 URL（带变量）
    pub resolved_url: String,  // 替换变量后的实际 URL
    pub headers: Vec<Header>,
    pub body: Option<String>,
    pub body_type: Option<String>,
    pub form_fields: Option<Vec<FormField>>,
    pub binary_file_path: Option<String>,
    // 响应数据
    pub status: u16,
    pub status_text: String,
    pub response_headers: std::collections::HashMap<String, String>,
    pub response_body: String,
    pub time: u64,           // 响应时间（毫秒）
    pub size: u64,           // 响应大小（字节）
    pub created_at: String,  // 请求时间
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_id: Option<String>,  // 关联的接口 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_name: Option<String>, // 关联的接口名称
}

/// 历史记录存储结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HistoryConfig {
    pub entries: Vec<HistoryEntry>,
}

/// Git 凭据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCredentials {
    pub id: String,
    pub username: String,
    /// 加密后的密码（Base64 编码）
    pub encrypted_password: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

/// Git 凭据配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitCredentialsConfig {
    pub credentials: Vec<GitCredentials>,
}
