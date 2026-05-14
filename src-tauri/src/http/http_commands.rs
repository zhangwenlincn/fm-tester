use crate::cookie::{get_cookies_config, save_cookies_config};
use crate::environment::{get_active_variables, replace_variables};
use crate::history::record_history;
use crate::models::{Cookie, CookiesConfig, FormField, Header, HttpResponse};
use chrono::{Local, Utc};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use url::Url;

/// HTTP 日志结构
#[derive(Clone, Serialize)]
struct HttpLog {
    #[serde(rename = "logType")]
    log_type: String,   // "request" | "response" | "error"
    timestamp: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// 发送日志事件
fn emit_log(app: &AppHandle, log: HttpLog) {
    if let Err(e) = app.emit("http-log", log) {
        eprintln!("发送日志事件失败: {}", e);
    }
}

/// 发送 HTTP 请求（支持环境变量替换、multipart/form-data、binary 文件）
#[tauri::command]
pub fn send_http_request(
    app: AppHandle,
    method: String,
    url: String,
    headers: Vec<Header>,
    body: Option<String>,
    body_type: Option<String>,
    form_fields: Option<Vec<FormField>>,
    binary_file_path: Option<String>,
    workspace_path: String,
    api_id: Option<String>,
    api_name: Option<String>,
) -> Result<HttpResponse, String> {
    let start_time = Instant::now();

    // 获取当前激活环境的变量
    let variables = get_active_variables(workspace_path.clone());
    
    // 收集所有未定义变量
    let mut all_undefined_vars: HashSet<String> = HashSet::new();

    // 替换 URL 中的变量
    let url_result = replace_variables(&url, &variables);
    let replaced_url = url_result.text;
    all_undefined_vars.extend(url_result.undefined_variables);

    // 替换 Headers 中的变量
    let replaced_headers: Vec<Header> = headers
        .iter()
        .map(|h| {
            let value_result = replace_variables(&h.value, &variables);
            all_undefined_vars.extend(value_result.undefined_variables);
            Header {
                key: h.key.clone(),
                value: value_result.text,
                enabled: h.enabled,
                description: h.description.clone(),
            }
        })
        .collect();

    // 替换 Body 中的变量（仅用于 raw 类型）
    let replaced_body = body.as_ref().map(|b| {
        let body_result = replace_variables(b, &variables);
        all_undefined_vars.extend(body_result.undefined_variables);
        body_result.text
    });
    
    // 如果有未定义变量，发送警告日志
    if !all_undefined_vars.is_empty() {
        let undefined_list: Vec<String> = all_undefined_vars.clone().into_iter().collect();
        let warning_log = HttpLog {
            log_type: "warning".to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            message: format!("未定义变量: {}", undefined_list.join(", ")),
            data: Some(serde_json::json!({ "undefinedVariables": undefined_list })),
            error: None,
        };
        emit_log(&app, warning_log);
    }

    // 发送请求日志
    let request_data = serde_json::json!({
        "method": method.to_uppercase(),
        "url": replaced_url.clone(),
        "headers": replaced_headers,
        "body": replaced_body,
        "bodyType": body_type
    });
    let request_log = HttpLog {
        log_type: "request".to_string(),
        timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        message: format!("{} {}", method.to_uppercase(), replaced_url),
        data: Some(request_data),
        error: None,
    };
    emit_log(&app, request_log);

    let client = reqwest::blocking::Client::new();

    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&replaced_url),
        "POST" => client.post(&replaced_url),
        "PUT" => client.put(&replaced_url),
        "DELETE" => client.delete(&replaced_url),
        "PATCH" => client.patch(&replaced_url),
        "HEAD" => client.head(&replaced_url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &replaced_url),
        _ => {
            let err_log = HttpLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: format!("不支持的 HTTP 方法: {}", method),
                data: None,
                error: Some(format!("不支持的 HTTP 方法: {}", method)),
            };
            emit_log(&app, err_log);
            return Err(format!("不支持的 HTTP 方法: {}", method));
        }
    };

    // 获取 URL 的 domain
    let parsed_url = Url::parse(&replaced_url).ok();
    let domain = parsed_url
        .as_ref()
        .and_then(|u| u.host_str())
        .unwrap_or("");

    // 获取并携带相关 cookies
    let cookies_config = get_cookies_config(workspace_path.clone());
    for cookie in &cookies_config.cookies {
        // 匹配 domain（支持子域名匹配）
        if domain.ends_with(&cookie.domain) || cookie.domain.ends_with(domain) {
            let cookie_header = format!("{}={}", cookie.name, cookie.value);
            request = request.header("Cookie", cookie_header);
        }
    }

    // 处理请求体类型
    let actual_body_type = body_type.clone().unwrap_or_else(|| "raw".to_string());

    // 发送 form-data 时，排除手动设置的 Content-Type（让 reqwest 自动生成带 boundary 的）
    let should_skip_content_type = actual_body_type == "form-data";

    // 添加 Headers（排除 form-data 的 Content-Type）
    for header in &replaced_headers {
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
                if let Some(ref fields) = form_fields {
                    let mut form = reqwest::blocking::multipart::Form::new();

                    for field in fields {
                        if !field.enabled || field.key.is_empty() {
                            continue;
                        }

                        match field.field_type.as_str() {
                            "text" => {
                                // 文本字段，替换变量
                                let replaced_value = replace_variables(&field.value, &variables);
                                all_undefined_vars.extend(replaced_value.undefined_variables);
                                form = form.text(field.key.clone(), replaced_value.text);
                            }
                            "file" => {
                                // 文件字段
                                if let Some(ref files) = field.files {
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
                if let Some(ref file_path) = binary_file_path {
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
                if let Some(ref b) = replaced_body {
                    request = request.body(b.clone());
                }
            }
        }
    }

    let response = match request.send() {
        Ok(r) => r,
        Err(e) => {
            let err_log = HttpLog {
                log_type: "error".to_string(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                message: format!("请求失败: {}", e),
                data: None,
                error: Some(format!("请求失败: {}", e)),
            };
            emit_log(&app, err_log);
            return Err(format!("请求失败: {}", e));
        }
    };

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

    // 从响应 headers 中提取 Set-Cookie 并保存
    if let Some(set_cookie_value) = response_headers.get("set-cookie") {
        // 解析 Set-Cookie header（可能有多个，用逗号分隔）
        for cookie_str in set_cookie_value.split(", ") {
            if let Ok(cookie) = parse_set_cookie(cookie_str, domain) {
                let config = get_cookies_config(workspace_path.clone());
                let mut cookies = config.cookies;
                // 更新或添加
                let existing_idx = cookies
                    .iter()
                    .position(|c| c.name == cookie.name && c.domain == cookie.domain);
                if let Some(idx) = existing_idx {
                    cookies[idx] = cookie;
                } else {
                    cookies.push(cookie);
                }
                if let Err(e) = save_cookies_config(workspace_path.clone(), CookiesConfig { cookies })
                {
                    eprintln!("保存 cookie 失败: {}", e);
                }
            }
        }
    }

    let response_body = response
        .text()
        .map_err(|e| format!("读取响应体失败: {}", e))?;
    let size = response_body.len() as u64;

    // 尝试解析 body 为 JSON
    let body_json: serde_json::Value = serde_json::from_str(&response_body)
        .unwrap_or_else(|_| serde_json::Value::String(response_body.clone()));

    // 发送响应日志
    let response_data = serde_json::json!({
        "status": status,
        "statusText": status_text,
        "time": elapsed,
        "size": size,
        "headers": response_headers,
        "body": body_json,
        "method": method.to_uppercase(),
        "url": replaced_url
    });
    let response_log = HttpLog {
        log_type: "response".to_string(),
        timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        message: format!("{} {} {} {} ({}ms, {} bytes)", method.to_uppercase(), replaced_url, status, status_text, elapsed, size),
        data: Some(response_data),
        error: None,
    };
    emit_log(&app, response_log);

    let http_response = HttpResponse {
        status,
        status_text,
        headers: response_headers,
        body: response_body,
        time: elapsed,
        size,
    };

    // 记录请求历史
    if let Err(e) = record_history(
        workspace_path.clone(),
        method.clone(),
        url.clone(),           // 原始 URL
        replaced_url.clone(),  // 替换变量后的 URL
        headers.clone(),
        body.clone(),          // 请求体（原始）
        body_type,
        form_fields,
        binary_file_path,
        &http_response,
        api_id,
        api_name,
    ) {
        eprintln!("记录历史失败: {}", e);
    }

    Ok(http_response)
}

/// 解析 Set-Cookie header
fn parse_set_cookie(cookie_str: &str, default_domain: &str) -> Result<Cookie, String> {
    let parts: Vec<&str> = cookie_str.split(';').collect();
    let name_value = parts.first().unwrap_or(&"");

    let (name, value) = name_value.split_once('=').unwrap_or(("", ""));

    let mut domain = default_domain.to_string();
    let mut path = "/".to_string();
    let mut secure = false;
    let mut http_only = false;
    let mut expires = None;
    let mut max_age = None;

    for part in parts.iter().skip(1) {
        let part = part.trim();
        if part.starts_with("Domain=") {
            domain = part[7..].to_string();
            // 移除前导点
            if domain.starts_with('.') {
                domain = domain[1..].to_string();
            }
        } else if part.starts_with("Path=") {
            path = part[5..].to_string();
        } else if part == "Secure" {
            secure = true;
        } else if part == "HttpOnly" {
            http_only = true;
        } else if part.starts_with("Expires=") {
            expires = Some(part[8..].to_string());
        } else if part.starts_with("Max-Age=") {
            max_age = part[8..].parse::<u64>().ok();
        }
    }

    Ok(Cookie {
        name: name.to_string(),
        value: value.to_string(),
        domain,
        path,
        expires,
        max_age,
        secure,
        http_only,
        created_at: Utc::now().to_rfc3339(),
    })
}
