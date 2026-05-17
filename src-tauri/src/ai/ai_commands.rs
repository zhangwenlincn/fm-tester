use reqwest;
use serde::{Deserialize, Serialize};

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
pub async fn get_ai_models(api_endpoint: String, api_key: String) -> Result<Vec<String>, String> {
    if api_endpoint.is_empty() {
        return Err("API endpoint is empty".to_string());
    }
    if api_key.is_empty() {
        return Err("API key is empty".to_string());
    }

    let url = format!("{}/models", api_endpoint.trim_end_matches('/'));
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(30))
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