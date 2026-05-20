use crate::import::openapi_types::{OpenApi3, Schema};
use crate::models::{Collection, Header, FormField, Param};
use uuid::Uuid;
use std::collections::HashMap;

pub fn convert_to_collection(
    openapi: OpenApi3,
    target_collection_id: Option<String>,
    root_name: Option<String>,
) -> Result<Collection, String> {
    let root_id = target_collection_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let root_name = root_name.unwrap_or_else(|| openapi.info.title.clone());
    
    // 构建 schemas 引用解析上下文
    let empty_schemas = HashMap::new();
    let schemas_ctx: &HashMap<String, Schema> = match &openapi.components {
        Some(c) => &c.schemas,
        None => &empty_schemas,
    };
    
    let mut tag_map: HashMap<String, Collection> = HashMap::new();
    let mut untagged_apis: Vec<Collection> = Vec::new();
    
    for tag in &openapi.tags {
        let tag_collection = Collection {
            id: Uuid::new_v4().to_string(),
            name: tag.name.clone(),
            description: tag.description.clone(),
            item_type: "collection".to_string(),
            children: Vec::new(),
            method: None,
            url: None,
            params: None,
            headers: None,
            body: None,
            body_type: None,
            form_fields: None,
            binary_file_path: None,
            saved_responses: None,
            common_headers: None,
            collection_variables: None,
        };
        tag_map.insert(tag.name.clone(), tag_collection);
    }
    
    for (path, path_item) in &openapi.paths {
        for (method, operation) in path_item.operations() {
            let api = convert_operation_to_api(path, method, operation, schemas_ctx);
            
            if operation.tags.is_empty() {
                untagged_apis.push(api);
            } else {
                if let Some(tag_name) = operation.tags.first() {
                    if !tag_map.contains_key(tag_name) {
                        let tag_collection = Collection {
                            id: Uuid::new_v4().to_string(),
                            name: tag_name.clone(),
                            description: None,
                            item_type: "collection".to_string(),
                            children: Vec::new(),
                            method: None,
                            url: None,
                            params: None,
                            headers: None,
                            body: None,
                            body_type: None,
                            form_fields: None,
                            binary_file_path: None,
                            saved_responses: None,
                            common_headers: None,
                            collection_variables: None,
                        };
                        tag_map.insert(tag_name.clone(), tag_collection);
                    }
                    if let Some(tag_collection) = tag_map.get_mut(tag_name) {
                        tag_collection.children.push(api);
                    }
                }
            }
        }
    }
    
    let mut children: Vec<Collection> = tag_map.into_values().collect();
    children.sort_by(|a, b| a.name.cmp(&b.name));
    
    if !untagged_apis.is_empty() {
        let untagged_collection = Collection {
            id: Uuid::new_v4().to_string(),
            name: "未分类".to_string(),
            description: Some("未分配标签的接口".to_string()),
            item_type: "collection".to_string(),
            children: untagged_apis,
            method: None,
            url: None,
            params: None,
            headers: None,
            body: None,
            body_type: None,
            form_fields: None,
            binary_file_path: None,
            saved_responses: None,
            common_headers: None,
            collection_variables: None,
        };
        children.push(untagged_collection);
    }
    
    let root = Collection {
        id: root_id,
        name: root_name,
        description: openapi.info.description.clone(),
        item_type: "collection".to_string(),
        children,
        method: None,
        url: None,
        params: None,
        headers: None,
        body: None,
        body_type: None,
        form_fields: None,
        binary_file_path: None,
        saved_responses: None,
        common_headers: None,
        collection_variables: None,
    };
    
    Ok(root)
}

fn convert_operation_to_api(
    path: &str,
    method: &str,
    operation: &crate::import::openapi_types::Operation,
    schemas_ctx: &HashMap<String, Schema>,
) -> Collection {
    let api_id = Uuid::new_v4().to_string();
    
    let name = operation.summary.clone()
        .or(operation.operation_id.clone())
        .unwrap_or_else(|| format!("{} {}", method, path));
    
    let name = if name.chars().count() > 50 {
        name.chars().take(47).collect::<String>() + "..."
    } else {
        name
    };
    
    let mut headers: Vec<Header> = Vec::new();
    let mut params: Vec<Param> = Vec::new();
    
    for param in &operation.parameters {
        match param.location.as_str() {
            "query" => {
                let value = param.example.clone()
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                params.push(Param {
                    key: param.name.clone(),
                    value,
                    enabled: true,
                    description: param.description.clone(),
                });
            }
            "header" => {
                let value = param.example.clone()
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                headers.push(Header {
                    key: param.name.clone(),
                    value,
                    enabled: true,
                    description: param.description.clone(),
                });
            }
            "path" => {}
            _ => {}
        }
    }
    
    let (body, body_type, form_fields) = extract_request_body(operation, schemas_ctx);
    
    Collection {
        id: api_id,
        name,
        description: operation.description.clone(),
        item_type: "api".to_string(),
        children: Vec::new(),
        method: Some(method.to_string()),
        url: Some(path.to_string()),
        params: if params.is_empty() { None } else { Some(params) },
        headers: if headers.is_empty() { None } else { Some(headers) },
        body,
        body_type,
        form_fields,
        binary_file_path: None,
        saved_responses: None,
        common_headers: None,
        collection_variables: None,
    }
}

fn extract_request_body(
    operation: &crate::import::openapi_types::Operation,
    schemas_ctx: &HashMap<String, Schema>,
) -> (Option<String>, Option<String>, Option<Vec<FormField>>) {
    let request_body = match &operation.request_body {
        Some(rb) => rb,
        None => return (None, None, None),
    };
    
    for (content_type, media_type) in &request_body.content {
        match content_type.as_str() {
            "application/json" => {
                let body = extract_json_example(media_type, schemas_ctx);
                return (body, Some("raw".to_string()), None);
            }
            "application/x-www-form-urlencoded" => {
                let form_fields = extract_form_fields(media_type, schemas_ctx);
                return (None, Some("form-data".to_string()), form_fields);
            }
            "multipart/form-data" => {
                let form_fields = extract_form_fields(media_type, schemas_ctx);
                return (None, Some("form-data".to_string()), form_fields);
            }
            "text/plain" => {
                let body = media_type.example.clone()
                    .and_then(|v| v.as_str().map(|s| s.to_string()));
                return (body, Some("raw".to_string()), None);
            }
            _ => {}
        }
    }
    
    (None, None, None)
}

fn extract_json_example(
    media_type: &crate::import::openapi_types::MediaType,
    schemas_ctx: &HashMap<String, Schema>,
) -> Option<String> {
    if let Some(ref example) = media_type.example {
        return Some(serde_json::to_string_pretty(example).unwrap_or_default());
    }
    
    if let Some(ref examples) = media_type.examples {
        if let Some(first_example) = examples.values().next() {
            if let Some(ref value) = first_example.value {
                return Some(serde_json::to_string_pretty(value).unwrap_or_default());
            }
        }
    }
    
    if let Some(ref schema) = media_type.schema {
        let generated = generate_example_from_schema(schema, schemas_ctx);
        return Some(serde_json::to_string_pretty(&generated).unwrap_or_default());
    }
    
    None
}

fn generate_example_from_schema(
    schema: &Schema,
    schemas_ctx: &HashMap<String, Schema>,
) -> serde_json::Value {
    // 处理 $ref 引用
    if let Some(ref ref_path) = schema.ref_path {
        // 解析引用路径: "#/components/schemas/SomeSchema"
        if ref_path.starts_with("#/components/schemas/") {
            let schema_name = ref_path.strip_prefix("#/components/schemas/").unwrap();
            if let Some(ref_schema) = schemas_ctx.get(schema_name) {
                // 递归解析引用的 schema
                return generate_example_from_schema(ref_schema, schemas_ctx);
            }
        }
        return serde_json::Value::String(format!("[未解析引用: {}]", ref_path));
    }
    
    if let Some(ref example) = schema.example {
        return example.clone();
    }
    
    match schema.schema_type.as_deref() {
        Some("string") => {
            if let Some(ref format) = schema.format {
                match format.as_str() {
                    "date" => serde_json::Value::String("2024-01-01".to_string()),
                    "date-time" => serde_json::Value::String("2024-01-01T00:00:00Z".to_string()),
                    "email" => serde_json::Value::String("user@example.com".to_string()),
                    "uri" => serde_json::Value::String("https://example.com".to_string()),
                    "uuid" => serde_json::Value::String("00000000-0000-0000-0000-000000000000".to_string()),
                    _ => serde_json::Value::String("".to_string()),
                }
            } else if !schema.enum_values.is_empty() {
                serde_json::Value::String(schema.enum_values[0].clone())
            } else {
                serde_json::Value::String("".to_string())
            }
        }
        Some("integer") => serde_json::Value::Number(serde_json::Number::from(0)),
        Some("number") => serde_json::Value::Number(
            serde_json::Number::from_f64(0.0).unwrap_or_else(|| serde_json::Number::from(0))
        ),
        Some("boolean") => serde_json::Value::Bool(false),
        Some("array") => {
            if let Some(ref items) = schema.items {
                serde_json::Value::Array(vec![generate_example_from_schema(items, schemas_ctx)])
            } else {
                serde_json::Value::Array(Vec::new())
            }
        }
        Some("object") => {
            let mut obj = serde_json::Map::new();
            for (key, prop_schema) in &schema.properties {
                obj.insert(key.clone(), generate_example_from_schema(prop_schema, schemas_ctx));
            }
            serde_json::Value::Object(obj)
        }
        _ => serde_json::Value::Null,
    }
}

fn extract_form_fields(
    media_type: &crate::import::openapi_types::MediaType,
    schemas_ctx: &HashMap<String, Schema>,
) -> Option<Vec<FormField>> {
    let schema = media_type.schema.as_ref()?;
    
    let resolved_schema = resolve_schema_ref(schema, schemas_ctx);
    
    let mut fields = Vec::new();
    for (name, prop_schema) in &resolved_schema.properties {
        let resolved_prop = resolve_schema_ref(prop_schema, schemas_ctx);
        let value = if let Some(ref example) = resolved_prop.example {
            example.as_str().unwrap_or("").to_string()
        } else {
            generate_example_from_schema(&resolved_prop, schemas_ctx)
                .as_str().unwrap_or("").to_string()
        };
        
        fields.push(FormField {
            key: name.clone(),
            value,
            field_type: "text".to_string(),
            enabled: true,
            files: None,
        });
    }
    
    if fields.is_empty() {
        None
    } else {
        Some(fields)
    }
}

fn resolve_schema_ref(schema: &Schema, schemas_ctx: &HashMap<String, Schema>) -> Schema {
    if let Some(ref ref_path) = schema.ref_path {
        if ref_path.starts_with("#/components/schemas/") {
            let schema_name = ref_path.strip_prefix("#/components/schemas/").unwrap();
            if let Some(ref_schema) = schemas_ctx.get(schema_name) {
                return resolve_schema_ref(ref_schema, schemas_ctx);
            }
        }
    }
    schema.clone()
}