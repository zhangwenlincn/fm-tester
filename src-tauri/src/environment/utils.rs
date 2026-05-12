use std::collections::HashMap;

/// 替换字符串中的环境变量 {{变量名}}
pub fn replace_variables(text: &str, variables: &HashMap<String, String>) -> String {
    let mut result = text.to_string();

    for (key, value) in variables {
        let pattern = format!("{{{{{}}}}}", key);
        result = result.replace(&pattern, value);
    }

    result
}
