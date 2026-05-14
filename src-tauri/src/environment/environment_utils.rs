use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// 变量替换结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceResult {
    /// 替换后的文本
    pub text: String,
    /// 未替换的变量列表（未定义的变量名）
    pub undefined_variables: Vec<String>,
}

impl std::fmt::Display for ReplaceResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.text)
    }
}

/// 替换字符串中的环境变量 {{变量名}}
/// 返回替换结果，包含未定义变量的警告
pub fn replace_variables(text: &str, variables: &HashMap<String, String>) -> ReplaceResult {
    // 正则匹配 {{变量名}}
    let re = regex::Regex::new(r"\{\{([^}]+)\}\}").unwrap();
    
    let mut result = text.to_string();
    
    // 找出所有变量引用
    let mut matches: Vec<(usize, usize, String)> = Vec::new();
    for cap in re.captures_iter(text) {
        let full_match = cap.get(0).unwrap();
        let var_name = cap.get(1).unwrap().as_str().trim();
        matches.push((full_match.start(), full_match.end(), var_name.to_string()));
    }
    
    // 按变量名分组，记录未定义的变量
    let mut undefined_set = std::collections::HashSet::new();
    
    // 替换已知变量
    for (_, _, var_name) in &matches {
        if !variables.contains_key(var_name) {
            undefined_set.insert(var_name.clone());
        }
    }
    
    // 实际替换
    for (key, value) in variables {
        let pattern = format!("{{{{{}}}}}", key);
        result = result.replace(&pattern, value);
    }
    
    // 收集未定义变量列表
    let mut undefined_variables: Vec<String> = undefined_set.into_iter().collect();
    undefined_variables.sort();
    
    ReplaceResult {
        text: result,
        undefined_variables,
    }
}