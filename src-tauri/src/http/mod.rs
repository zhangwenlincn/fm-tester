use crate::models::{Header, HttpResponse};
use std::collections::HashMap;
use std::time::Instant;

/// 发送 HTTP 请求
#[tauri::command]
pub fn send_http_request(
    method: String,
    url: String,
    headers: Vec<Header>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    let start_time = Instant::now();
    
    let client = reqwest::blocking::Client::new();
    
    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        "HEAD" => client.head(&url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &url),
        _ => return Err(format!("不支持的 HTTP 方法: {}", method)),
    };
    
    for header in headers {
        if header.enabled {
            request = request.header(&header.key, &header.value);
        }
    }
    
    if let Some(b) = body {
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