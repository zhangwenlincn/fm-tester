use reqwest;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::models::Header;
use crate::settings::read_settings;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::Instant;

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
    api_endpoint: String,
    api_key: String,
    custom_headers: Option<Vec<Header>>,
) -> Result<Vec<String>, String> {
    if api_endpoint.is_empty() {
        return Err("API endpoint is empty".to_string());
    }
    if api_key.is_empty() {
        return Err("API key is empty".to_string());
    }

    let url = format!("{}/models", api_endpoint.trim_end_matches('/'));
    
    let client = reqwest::Client::new();
    let mut request = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(30));
    
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
    api_endpoint: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    custom_headers: Option<Vec<Header>>,
) -> Result<String, String> {
    // 从设置中读取超时配置
    let settings = read_settings();
    let timeout = settings.ai.timeout;
    
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