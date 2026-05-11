use crate::models::{Header, HttpResponse};
use crate::environment::{get_active_variables, replace_variables};
use std::collections::HashMap;
use std::time::Instant;

/// 发送 HTTP 请求（支持环境变量替换）
#[tauri::command]
pub fn send_http_request(
    method: String,
    url: String,
    headers: Vec<Header>,
    body: Option<String>,
    workspace_path: String,
) -> Result<HttpResponse, String> {
    let start_time = Instant::now();
    
    // 获取当前激活环境的变量
    let variables = get_active_variables(workspace_path);
    
    // 替换 URL 中的变量
    let replaced_url = replace_variables(&url, &variables);
    
    // 替换 Headers 中的变量
    let replaced_headers: Vec<Header> = headers
        .iter()
        .map(|h| Header {
            key: h.key.clone(),
            value: replace_variables(&h.value, &variables),
            enabled: h.enabled,
        })
        .collect();
    
    // 替换 Body 中的变量
    let replaced_body = body.map(|b| replace_variables(&b, &variables));
    
    let client = reqwest::blocking::Client::new();
    
    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&replaced_url),
        "POST" => client.post(&replaced_url),
        "PUT" => client.put(&replaced_url),
        "DELETE" => client.delete(&replaced_url),
        "PATCH" => client.patch(&replaced_url),
        "HEAD" => client.head(&replaced_url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &replaced_url),
        _ => return Err(format!("不支持的 HTTP 方法: {}", method)),
    };
    
    for header in replaced_headers {
        if header.enabled {
            request = request.header(&header.key, &header.value);
        }
    }
    
    if let Some(b) = replaced_body {
        if method != "GET" && method != "HEAD" {
            request = request.body(b);
        }
    }
    
    let response = request.send().map_err(|e| format!("请求失败: {}", e))?;
    
    let elapsed = start_time.elapsed().as_millis() as u64;
    
    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("").to_string();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    
    let body = response.text().map_err(|e| format!("读取响应体失败: {}", e))?;
    let size = body.len() as u64;
    
    Ok(HttpResponse {
        status,
        status_text,
        headers: response_headers,
        body,
        time: elapsed,
        size,
    })
}