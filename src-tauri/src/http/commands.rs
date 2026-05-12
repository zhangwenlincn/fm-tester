use crate::environment::{get_active_variables, replace_variables};
use crate::models::{FormField, Header, HttpResponse};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::Instant;

/// 发送 HTTP 请求（支持环境变量替换、multipart/form-data、binary 文件）
#[tauri::command]
pub fn send_http_request(
    method: String,
    url: String,
    headers: Vec<Header>,
    body: Option<String>,
    body_type: Option<String>,
    form_fields: Option<Vec<FormField>>,
    binary_file_path: Option<String>,
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

    // 替换 Body 中的变量（仅用于 raw 类型）
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

    // 处理请求体类型
    let actual_body_type = body_type.unwrap_or_else(|| "raw".to_string());

    // 发送 form-data 时，排除手动设置的 Content-Type（让 reqwest 自动生成带 boundary 的）
    let should_skip_content_type = actual_body_type == "form-data";

    // 添加 Headers（排除 form-data 的 Content-Type）
    for header in replaced_headers {
        if header.enabled {
            // 跳过 form-data 类型时手动设置的 Content-Type
            if should_skip_content_type && header.key.to_lowercase() == "content-type" {
                continue;
            }
            request = request.header(&header.key, &header.value);
        }
    }

    // 处理请求体
    if method != "GET" && method != "HEAD" {
        match actual_body_type.as_str() {
            "form-data" => {
                // multipart/form-data
                if let Some(fields) = form_fields {
                    let mut form = reqwest::blocking::multipart::Form::new();

                    for field in fields {
                        if !field.enabled || field.key.is_empty() {
                            continue;
                        }

                        match field.field_type.as_str() {
                            "text" => {
                                // 文本字段，替换变量
                                let replaced_value = replace_variables(&field.value, &variables);
                                form = form.text(field.key.clone(), replaced_value);
                            }
                            "file" => {
                                // 文件字段
                                if let Some(files) = field.files {
                                    for file_info in files {
                                        let file_path = Path::new(&file_info.path);
                                        if file_path.exists() {
                                            // 读取文件内容
                                            let file_content =
                                                fs::read(file_path).map_err(|e| {
                                                    format!(
                                                        "读取文件失败 {}: {}",
                                                        file_info.path, e
                                                    )
                                                })?;

                                            form = form.part(
                                                field.key.clone(),
                                                reqwest::blocking::multipart::Part::bytes(
                                                    file_content,
                                                )
                                                .file_name(file_info.name.clone()),
                                            );
                                        } else {
                                            return Err(format!("文件不存在: {}", file_info.path));
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    }

                    request = request.multipart(form);
                }
            }
            "binary" => {
                // binary 文件上传
                if let Some(file_path) = binary_file_path {
                    let path = Path::new(&file_path);
                    if path.exists() {
                        let file_content = fs::read(path)
                            .map_err(|e| format!("读取文件失败 {}: {}", file_path, e))?;
                        request = request.body(file_content);
                    } else {
                        return Err(format!("文件不存在: {}", file_path));
                    }
                }
            }
            _ => {
                // raw 或其他类型，使用字符串 body
                if let Some(b) = replaced_body {
                    request = request.body(b);
                }
            }
        }
    }

    let response = request.send().map_err(|e| format!("请求失败: {}", e))?;

    let elapsed = start_time.elapsed().as_millis() as u64;

    let status = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("")
        .to_string();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let body = response
        .text()
        .map_err(|e| format!("读取响应体失败: {}", e))?;
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
