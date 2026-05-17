use reqwest;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::models::Header;
use crate::settings::read_settings;
use crate::git::decrypt_string;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::Instant;

/// 从设置中获取解密后的 API key
fn get_decrypted_api_key() -> Result<String, String> {
    let settings = read_settings();
    if settings.ai.encrypted_api_key.is_empty() {
        return Err("请先配置 AI API Key".to_string());
    }
    decrypt_string(&settings.ai.encrypted_api_key)
        .map_err(|e| format!("解密 API Key 失败: {}", e))
}

/// 生成任务状态（用于取消检查）
#[derive(Debug, Clone)]
pub struct GenerationTaskState {
    pub cancelled: bool,
    pub start_time: Instant,
}

lazy_static::lazy_static! {
    pub static ref GENERATION_TASK_STATE: Arc<Mutex<HashMap<String, GenerationTaskState>>> = Arc::new(Mutex::new(HashMap::new()));
}

/// 初始化生成任务状态
pub fn init_generation_task(task_id: &str) {
    let mut state = GENERATION_TASK_STATE.lock().unwrap();
    state.insert(task_id.to_string(), GenerationTaskState {
        cancelled: false,
        start_time: Instant::now(),
    });
}

/// 检查生成任务是否被取消
pub fn is_generation_cancelled(task_id: &str) -> bool {
    let state = GENERATION_TASK_STATE.lock().unwrap();
    if let Some(task) = state.get(task_id) {
        task.cancelled
    } else {
        false
    }
}

/// 取消生成任务
pub fn cancel_generation_task(task_id: &str) {
    let mut state = GENERATION_TASK_STATE.lock().unwrap();
    if let Some(task) = state.get_mut(task_id) {
        task.cancelled = true;
    }
}

/// 清理生成任务状态
pub fn cleanup_generation_task(task_id: &str) {
    let mut state = GENERATION_TASK_STATE.lock().unwrap();
    state.remove(task_id);
}

/// 获取生成任务耗时
pub fn get_generation_elapsed_seconds(task_id: &str) -> u64 {
    let state = GENERATION_TASK_STATE.lock().unwrap();
    if let Some(task) = state.get(task_id) {
        task.start_time.elapsed().as_secs()
    } else {
        0
    }
}

/// 检查生成任务是否存在且未取消
pub fn is_generation_running(task_id: &str) -> bool {
    let state = GENERATION_TASK_STATE.lock().unwrap();
    if let Some(task) = state.get(task_id) {
        !task.cancelled
    } else {
        false
    }
}

/// 模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiModel {
    pub id: String,
    pub name: Option<String>,
    pub owned_by: Option<String>,
}

/// 模型列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub data: Vec<AiModel>,
}

/// 获取 AI 模型列表
#[tauri::command]
pub async fn get_ai_models(
    custom_headers: Option<Vec<Header>>,
) -> Result<Vec<String>, String> {
    let settings = read_settings();
    let api_endpoint = settings.ai.api_endpoint;
    
    if api_endpoint.is_empty() {
        return Err("请先配置 AI API Endpoint".to_string());
    }
    
    // 从设置中解密获取 API key
    let api_key = get_decrypted_api_key()?;
    
    let url = format!("{}/models", api_endpoint.trim_end_matches('/'));
    
    let client = reqwest::Client::new();
    let mut request = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(30));
    
    // 添加自定义请求头（使用传入的或设置中的）
    let headers = custom_headers.or_else(|| {
        if settings.ai.custom_headers.is_empty() {
            None
        } else {
            Some(settings.ai.custom_headers)
        }
    });
    
    if let Some(headers) = headers {
        for header in headers {
            if header.enabled {
                request = request.header(&header.key, &header.value);
            }
        }
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API returned status {}: {}", status, body));
    }

    let models: ModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let model_ids = models.data.iter().map(|m| m.id.clone()).collect();
    Ok(model_ids)
}

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// 聊天请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

/// 流式响应 delta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStreamResponse {
    pub id: String,
    pub choices: Vec<ChatStreamChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStreamChoice {
    pub index: u32,
    pub delta: ChatDelta,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    /// 思考过程内容（如 DeepSeek 的 reasoning_content）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
}

/// AI 聊天（流式）
#[tauri::command]
pub async fn chat_ai(
    app: AppHandle,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    // 从设置中读取配置
    let settings = read_settings();
    let api_endpoint = settings.ai.api_endpoint;
    let model = settings.ai.model;
    let timeout = settings.ai.timeout;
    let custom_headers = if settings.ai.custom_headers.is_empty() {
        None
    } else {
        Some(settings.ai.custom_headers)
    };
    
    if api_endpoint.is_empty() {
        return Err("请先配置 AI API Endpoint".to_string());
    }
    if model.is_empty() {
        return Err("请先配置 AI Model".to_string());
    }
    
    // 从设置中解密获取 API key
    let api_key = get_decrypted_api_key()?;
    
    // 内部调用，无取消检查
    chat_ai_internal(app, api_endpoint, api_key, model, messages, custom_headers, None, timeout).await
}

/// AI 聊天内部实现（支持取消检查）
pub async fn chat_ai_internal(
    app: AppHandle,
    api_endpoint: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    custom_headers: Option<Vec<Header>>,
    task_id: Option<String>,
    timeout: u64,
) -> Result<String, String> {
    if api_endpoint.is_empty() {
        return Err("API endpoint is empty".to_string());
    }
    if api_key.is_empty() {
        return Err("API key is empty".to_string());
    }
    if model.is_empty() {
        return Err("Model is empty".to_string());
    }

    let url = format!("{}/chat/completions", api_endpoint.trim_end_matches('/'));
    
    let request_body = ChatRequest {
        model,
        messages,
        stream: Some(true),
    };

    let client = reqwest::Client::new();
    let mut request = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(timeout));
    
    // 添加自定义请求头
    if let Some(headers) = custom_headers {
        for header in headers {
            if header.enabled {
                request = request.header(&header.key, &header.value);
            }
        }
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API returned status {}: {}", status, body));
    }

    // 处理流式响应
    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut full_content = String::new();
    let mut full_reasoning = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        // 检查是否被取消
        if let Some(id) = &task_id {
            if is_generation_cancelled(id) {
                return Err("生成已取消".to_string());
            }
        }
        
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        let chunk_text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_text);

        // 解析 SSE 格式 - 循环处理所有完整行
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line == "data: [DONE]" {
                continue;
            }

            if line.starts_with("data: ") {
                let data = &line[6..];
                if let Ok(stream_resp) = serde_json::from_str::<ChatStreamResponse>(data) {
                    for choice in &stream_resp.choices {
                        // 处理思考过程内容
                        if let Some(reasoning) = &choice.delta.reasoning_content {
                            full_reasoning.push_str(reasoning);
                            // 发送思考过程事件到前端
                            app.emit("ai-chat-reasoning", reasoning).ok();
                        }
                        // 处理正常内容
                        if let Some(content) = &choice.delta.content {
                            full_content.push_str(content);
                            // 发送流式事件到前端
                            app.emit("ai-chat-stream", content).ok();
                        }
                    }
                }
            }
        }
    }

    Ok(full_content)
}

/// AI 优化脚本
#[tauri::command]
pub async fn optimize_script_ai(
    app: AppHandle,
    script_content: String,
    script_type: String,
) -> Result<String, String> {
    // 从设置中读取配置
    let settings = read_settings();
    let api_endpoint = settings.ai.api_endpoint;
    let model = settings.ai.model;
    let timeout = settings.ai.timeout;
    let custom_headers = if settings.ai.custom_headers.is_empty() {
        None
    } else {
        Some(settings.ai.custom_headers)
    };
    
    if api_endpoint.is_empty() {
        return Err("请先配置 AI API Endpoint".to_string());
    }
    if model.is_empty() {
        return Err("请先配置 AI Model".to_string());
    }
    
    // 从设置中解密获取 API key
    let api_key = get_decrypted_api_key()?;

    // 构建系统提示
    let system_prompt = if script_type == "pre" {
        "你是一个API测试脚本专家。请优化或完善用户提供的前置脚本（Pre-request Script）。

前置脚本在请求发送前执行，可以使用以下 fm API：
- fm.environment.get(key) / fm.environment.set(key, value) / fm.environment.getAll() - 环境变量操作
- fm.collection.get(key) / fm.collection.set(key, value) / fm.collection.getAll() - 集合变量操作
- fm.request.getUrl() / fm.request.setUrl(url) - 获取/设置请求URL
- fm.request.getBaseUrl() / fm.request.setBaseUrl(baseUrl) - 获取/设置baseUrl
- fm.request.getPath() / fm.request.setPath(path) - 获取/设置请求路径
- fm.request.getMethod() / fm.request.setMethod(method) - 获取/设置请求方法
- fm.request.getHeader(key) / fm.request.setHeader(key, value) / fm.request.removeHeader(key) / fm.request.getHeaders() - 请求头操作
- fm.request.getBody() / fm.request.setBody(body) - 获取/设置请求体
- fm.log(message) - 输出日志到Console
- fm.assert(condition, message) - 断言检查
- fm.sleep(ms) - 异步等待（毫秒）

请根据用户的需求或现有脚本，优化、完善或生成JavaScript脚本代码。
只返回纯JavaScript代码，不要包含任何解释或markdown格式。"
    } else {
        "你是一个API测试脚本专家。请优化或完善用户提供的后置脚本（Post-request Script）。

后置脚本在响应返回后执行，可以使用以下 fm API（包括前置脚本所有API）：
- fm.response.getStatus() - 获取响应状态码
- fm.response.getStatusText() - 获取响应状态文本
- fm.response.getHeader(key) / fm.response.getHeaders() - 获取响应头
- fm.response.getBody() - 获取响应体（字符串）
- fm.response.getJson() - 获取响应体（JSON对象）
- fm.response.getTime() - 获取响应时间（ms）
- fm.response.getSize() - 获取响应大小（bytes）
- fm.environment.get(key) / fm.environment.set(key, value) / fm.environment.getAll() - 环境变量操作
- fm.collection.get(key) / fm.collection.set(key, value) / fm.collection.getAll() - 集合变量操作
- fm.log(message) - 输出日志到Console
- fm.assert(condition, message) - 断言检查
- fm.sleep(ms) - 异步等待（毫秒）

请根据用户的需求或现有脚本，优化、完善或生成JavaScript脚本代码。
只返回纯JavaScript代码，不要包含任何解释或markdown格式。"
    };

    // 构建消息
    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: if script_content.trim().is_empty() {
                "请帮我生成一个基础的脚本模板。".to_string()
            } else {
                format!("请优化或完善以下脚本：\n\n{}", script_content)
            },
        },
    ];

    // 调用内部聊天函数
    chat_ai_internal(app, api_endpoint, api_key, model, messages, custom_headers, None, timeout).await
}