use reqwest;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::models::Header;

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
        .timeout(std::time::Duration::from_secs(120));
    
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
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
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