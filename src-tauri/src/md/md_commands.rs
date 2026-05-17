use crate::md::md_config::{read_api_doc, write_api_doc, get_doc_index_entry};
use crate::settings::{read_settings};
use crate::collection::{find_api_in_collections, read_collections};
use crate::history::history_config::{list_history_dates, load_history_by_date};
use crate::saved_response::saved_response_config::{get_api_saved_responses_index, read_saved_response_file};
use crate::ai::{ChatMessage, chat_ai_internal, init_generation_task, is_generation_running, cancel_generation_task, cleanup_generation_task, get_generation_elapsed_seconds};
use crate::models::{Collection, Header, HistoryEntry, SavedResponse};
use tauri::{AppHandle, Emitter, command};

/// 文档生成状态
#[derive(Debug, Clone, serde::Serialize)]
pub struct DocGenerationStatus {
    pub api_id: String,
    pub generating: bool,
    pub elapsed_seconds: u64,
    pub error: Option<String>,
}

/// 文档元数据
#[derive(Debug, Clone, serde::Serialize)]
pub struct DocMetadata {
    pub api_id: String,
    pub updated_at: Option<String>,
}

/// 获取 API 文档内容
#[command]
pub fn get_api_doc(workspace_path: String, api_id: String) -> Result<String, String> {
    read_api_doc(&workspace_path, &api_id)
}

/// 保存 API 文档内容
#[command]
pub fn save_api_doc(workspace_path: String, api_id: String, content: String) -> Result<(), String> {
    write_api_doc(&workspace_path, &api_id, &content)
}

/// 获取 API 文档元数据（包含最新编辑保存时间）
#[command]
pub fn get_api_doc_metadata(workspace_path: String, api_id: String) -> Result<DocMetadata, String> {
    let entry = get_doc_index_entry(&workspace_path, &api_id);
    
    Ok(DocMetadata {
        api_id: api_id.clone(),
        updated_at: entry.map(|e| e.updated_at),
    })
}

/// 获取文档生成状态（按接口ID）
#[command]
pub fn get_doc_generation_status(api_id: String) -> Result<DocGenerationStatus, String> {
    let generating = is_generation_running(&api_id);
    let elapsed = get_generation_elapsed_seconds(&api_id);
    
    Ok(DocGenerationStatus {
        api_id,
        generating,
        elapsed_seconds: elapsed,
        error: None,
    })
}

/// 取消文档生成（按接口ID）
#[command]
pub fn cancel_doc_generation(api_id: String) -> Result<(), String> {
    cancel_generation_task(&api_id);
    Ok(())
}

/// AI 生成 API 文档
#[command]
pub async fn generate_api_doc_with_ai(
    app: AppHandle,
    workspace_path: String,
    api_id: String,
) -> Result<String, String> {
    // 检查是否已有任务正在进行
    if is_generation_running(&api_id) {
        return Err("该接口已有生成任务正在进行".to_string());
    }
    
    // 初始化生成任务状态
    init_generation_task(&api_id);
    
    // 发送开始事件
    app.emit("doc-generation-start", &api_id).ok();
    
    let result = do_generate_api_doc_async(&app, &workspace_path, &api_id).await;
    
    // 清理状态
    cleanup_generation_task(&api_id);
    
    // 发送完成事件
    match &result {
        Ok(content) => {
            app.emit("doc-generation-complete", content).ok();
        }
        Err(e) => {
            app.emit("doc-generation-error", e).ok();
        }
    }
    
    result
}

/// 执行文档生成（异步版本）
async fn do_generate_api_doc_async(
    app: &AppHandle,
    workspace_path: &str,
    api_id: &str,
) -> Result<String, String> {
    // 1. 获取AI配置
    let settings = read_settings();
    let ai_config = settings.ai;
    
    if ai_config.api_key.is_empty() || ai_config.api_endpoint.is_empty() {
        return Err("请先配置 AI 设置".to_string());
    }
    
    // 2. 获取接口定义
    let collections_config = read_collections(workspace_path);
    let api_data = find_api_in_collections(&collections_config.collections, api_id)
        .ok_or_else(|| "接口不存在".to_string())?;
    
    // 3. 获取现有文档
    let existing_doc = read_api_doc(workspace_path, api_id).unwrap_or_default();
    
    // 4. 获取保存的响应
    let saved_responses_index = get_api_saved_responses_index(workspace_path.to_string(), api_id.to_string());
    let saved_responses: Vec<SavedResponse> = saved_responses_index
        .iter()
        .filter_map(|entry| read_saved_response_file(workspace_path.to_string(), entry.id.clone()))
        .collect();
    
    // 5. 获取历史记录（最近3天，最多10条）
    let history_dates = list_history_dates(workspace_path.to_string());
    let recent_dates: Vec<String> = history_dates.into_iter().take(3).collect();
    let mut history_entries: Vec<HistoryEntry> = Vec::new();
    
    for date in recent_dates {
        if history_entries.len() >= 10 {
            break;
        }
        let entries = load_history_by_date(workspace_path.to_string(), date);
        let api_history: Vec<HistoryEntry> = entries
            .into_iter()
            .filter(|e| e.api_id == Some(api_id.to_string()))
            .collect();
        history_entries.extend(api_history);
    }
    history_entries = history_entries.into_iter().take(10).collect();
    
    // 6. 构建提示
    let prompt = build_doc_prompt(api_data, &existing_doc, &saved_responses, &history_entries);
    
    // 7. 发送进度事件
    app.emit("doc-generation-progress", "正在调用AI生成...").ok();
    
    // 8. 调用AI（带取消检查）
    let messages = vec![ChatMessage {
        role: "user".to_string(),
        content: prompt,
    }];
    
    // 获取自定义请求头
    let custom_headers: Option<Vec<Header>> = if ai_config.custom_headers.is_empty() {
        None
    } else {
        Some(ai_config.custom_headers)
    };
    
    // 获取超时配置
    let timeout = ai_config.timeout;
    
    // 调用 chat_ai_internal（支持取消检查）
    let content = chat_ai_internal(
        app.clone(),
        ai_config.api_endpoint.clone(),
        ai_config.api_key.clone(),
        ai_config.model.clone(),
        messages,
        custom_headers,
        Some(api_id.to_string()),
        timeout,
    ).await?;
    
    // 9. 自动保存
    write_api_doc(workspace_path, api_id, &content)?;
    
    Ok(content)
}

/// 构建文档生成提示
fn build_doc_prompt(
    api_data: &Collection,
    existing_doc: &str,
    saved_responses: &[SavedResponse],
    history_entries: &[HistoryEntry],
) -> String {
    let mut parts: Vec<String> = Vec::new();
    
    parts.push("请根据以下信息生成接口文档（Markdown格式）：".to_string());
    parts.push("\n## 接口定义".to_string());
    
    parts.push(format!("- 名称：{}", api_data.name));
    
    if let Some(desc) = &api_data.description {
        parts.push(format!("- 描述：{}", desc));
    }
    
    let method = api_data.method.clone().unwrap_or_else(|| "未知".to_string());
    parts.push(format!("- 方法：{}", method));
    
    // 只显示 PATH，去掉域名
    let url = api_data.url.clone().unwrap_or_else(|| "未知".to_string());
    let path = if url.starts_with("http://") || url.starts_with("https://") {
        // 提取 path 部分：跳过协议和域名
        let scheme_end = url.find("://").map(|p| p + 3).unwrap_or(0);
        let rest = &url[scheme_end..];
        // 找到第一个 / 的位置
        if let Some(pos) = rest.find('/') {
            rest[pos..].to_string()
        } else {
            "/".to_string()
        }
    } else {
        url.clone()
    };
    
    // 着重提示请求PATH
    parts.push("\n### 请求路径".to_string());
    parts.push(format!("**重要**：请求PATH为 `{}`", path));
    parts.push("请确保文档中明确标注此路径，并在示例中使用正确的路径。".to_string());
    
    // 请求头
    if let Some(headers) = &api_data.headers {
        let enabled_headers: Vec<&Header> = headers.iter().filter(|h| h.enabled).collect();
        if !enabled_headers.is_empty() {
            parts.push("\n### 请求头".to_string());
            parts.push("| 名称 | 值 | 描述 |".to_string());
            parts.push("|------|------|------|".to_string());
            for h in enabled_headers {
                let desc = h.description.clone().unwrap_or_else(|| "-".to_string());
                parts.push(format!("| {} | {} | {} |", h.key, h.value, desc));
            }
        }
    }
    
    // 请求体
    if let Some(body) = &api_data.body {
        parts.push("\n### 请求体".to_string());
        let body_type = api_data.body_type.clone().unwrap_or_else(|| "raw".to_string());
        parts.push(format!("类型：{}", body_type));
        parts.push(format!("\n{}", body));
    }
    
    // Form字段
    if let Some(form_fields) = &api_data.form_fields {
        let enabled_fields: Vec<&crate::models::FormField> = form_fields.iter().filter(|f| f.enabled).collect();
        if !enabled_fields.is_empty() {
            parts.push("\n### Form字段".to_string());
            parts.push("| 字段名 | 值 | 类型 |".to_string());
            parts.push("|--------|------|------|".to_string());
            for f in enabled_fields {
                parts.push(format!("| {} | {} | {} |", f.key, f.value, f.field_type));
            }
        }
    }
    
    // 现有文档
    if !existing_doc.is_empty() {
        parts.push("\n## 现有文档".to_string());
        parts.push("以下是已有的文档内容，请在此基础上完善和补充：".to_string());
        parts.push(format!("\n{}", existing_doc));
    }
    
    // 保存的响应示例
    if !saved_responses.is_empty() {
        parts.push("\n## 保存的响应示例".to_string());
        parts.push("以下是已保存的响应数据，**请完整分析响应结构并生成详细的响应参数说明**：".to_string());
        for (i, resp) in saved_responses.iter().take(3).enumerate() {
            parts.push(format!("\n### 示例 {}: {}", i + 1, resp.name));
            parts.push(format!("- 状态码：{}", resp.response.status));
            let body = &resp.response.body;
            // 增加截断限制到 3000 字符，确保响应结构完整
            let truncated = if body.len() > 3000 {
                format!("{}...\n\n**注意**：响应体较长，已截断显示，但请根据可见部分推断完整的响应结构。", &body[..3000])
            } else {
                body.clone()
            };
            parts.push("- 响应体：".to_string());
            parts.push(format!("\n{}", truncated));
        }
        parts.push("\n**要求**：请仔细分析上述响应数据的 JSON 结构，为每个字段生成详细的参数说明（字段名、类型、含义、是否必返回）。".to_string());
    }
    
    // 历史请求记录
    if !history_entries.is_empty() {
        parts.push("\n## 历史请求记录".to_string());
        parts.push("以下是历史请求记录，可帮助理解接口实际使用情况：".to_string());
        for (i, entry) in history_entries.iter().take(5).enumerate() {
            parts.push(format!("\n### 请求 {}", i + 1));
            parts.push(format!("- 时间：{}", entry.created_at));
            parts.push(format!("- 状态码：{} {}", entry.status, entry.status_text));
            parts.push(format!("- 响应时间：{}ms", entry.time));
            let body = &entry.response_body;
            // 增加截断限制到 2000 字符
            let truncated = if body.len() > 2000 {
                format!("{}...\n\n**注意**：响应体已截断，请根据可见部分分析响应结构。", &body[..2000])
            } else {
                body.clone()
            };
            parts.push("- 响应体片段：".to_string());
            parts.push(format!("\n{}", truncated));
        }
    }
    
    // 输出要求
    parts.push("\n## 输出要求".to_string());
    parts.push("请生成一份完整的接口文档，包括：".to_string());
    parts.push("1. 接口概述（**必须包含请求PATH**）".to_string());
    parts.push("2. 请求参数说明".to_string());
    parts.push("3. 请求示例（**PATH必须正确**）".to_string());
    parts.push("4. **响应参数说明**（**必须完整**）：".to_string());
    parts.push("   - 列出响应 JSON 中的所有字段".to_string());
    parts.push("   - 说明每个字段的类型（string/number/boolean/object/array/null）".to_string());
    parts.push("   - 说明每个字段的含义和用途".to_string());
    parts.push("   - 标注是否为必返回字段".to_string());
    parts.push("   - 对于嵌套对象，逐层展开说明".to_string());
    parts.push("   - 对于数组类型，说明数组元素的类型和结构".to_string());
    parts.push("5. **响应示例**（**必须完整**）：".to_string());
    parts.push("   - 提供至少一个完整的 JSON 响应示例".to_string());
    parts.push("   - 示例应包含所有重要字段".to_string());
    parts.push("   - 使用真实的响应数据作为参考".to_string());
    parts.push("6. 错误码说明（如果有）".to_string());
    parts.push("7. 使用注意事项".to_string());
    parts.push("\n**特别提醒**：".to_string());
    parts.push("- 文档中所有请求示例的PATH必须与上述请求路径保持一致。".to_string());
    parts.push("- **不需要显示完整的请求URL**，只显示请求PATH即可。".to_string());
    parts.push("- **响应参数说明必须覆盖响应 JSON 中的所有可见字段**，不可遗漏。".to_string());
    parts.push("- **响应示例必须足够完整**，展示接口的完整返回结构。".to_string());
    parts.push("\n请直接输出Markdown格式的文档内容，无需其他说明。".to_string());
    
    parts.join("\n")
}