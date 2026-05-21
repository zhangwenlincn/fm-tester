use fm_tester_lib::import::parse_curl_command;

#[test]
fn test_cmd_format_curl() {
    let cmd_format = r#"curl ^"https://seed-dev.ener-os.net/base/api/region/provinces^" ^
  -H ^"Accept: application/json, text/plain, */*^" ^
  -H ^"Authorization: test123^""#;

    let result = parse_curl_command(cmd_format);
    println!("CMD format result: {:?}", result);
    
    match result {
        Ok(parsed) => {
            println!("Method: {}", parsed.method);
            println!("URL: {}", parsed.url);
            println!("Headers: {:?}", parsed.headers);
            assert_eq!(parsed.method, "GET");
            assert_eq!(parsed.url, "https://seed-dev.ener-os.net/base/api/region/provinces");
            assert!(parsed.headers.len() > 0);
        }
        Err(e) => {
            panic!("CMD format parsing failed: {}", e);
        }
    }
}

#[test]
fn test_cmd_format_full_headers() {
    let cmd_format = r#"curl ^"https://seed-dev.ener-os.net/base/api/region/provinces^" ^
  -H ^"Accept: application/json, text/plain, */*^" ^
  -H ^"Accept-Language: zh-CN,zh;q=0.9^" ^
  -H ^"Authorization: eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsImlzc3VlZEF0IjoxNzc5MzI1Mjk3MTY4LCJpYXQiOjE3NzkzMjUyOTcsImV4cCI6MTc3OTQxMTY5N30.YWQshDDtJlhNfaJzBg2e2GZHcsd8wGh7wkVdjO1_duQ^" ^
  -H ^"Cache-Control: no-cache^" ^
  -H ^"Connection: keep-alive^" ^
  -H ^"Pragma: no-cache^" ^
  -H ^"Referer: https://seed-dev.ener-os.net/monitor/overview^" ^
  -H ^"Sec-Fetch-Dest: empty^" ^
  -H ^"Sec-Fetch-Mode: cors^" ^
  -H ^"Sec-Fetch-Site: same-origin^" ^
  -H ^"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36^" ^
  -H ^"lang: zh-CN^" ^
  -H ^"sec-ch-ua: ^\^"Chromium^\^";v=^\^"148^\^", ^\^"Google Chrome^\^";v=^\^"148^\^", ^\^"Not/A)Brand^\^";v=^\^"99^\^"^" ^
  -H ^"sec-ch-ua-mobile: ?0^" ^
  -H ^"sec-ch-ua-platform: ^\^"Windows^\^"^""#;

    let result = parse_curl_command(cmd_format);
    
    match result {
        Ok(parsed) => {
            println!("Full CMD format result:");
            println!("Method: {}", parsed.method);
            println!("URL: {}", parsed.url);
            println!("Headers count: {}", parsed.headers.len());
            for h in &parsed.headers {
                println!("  {}: {}", h.key, h.value);
            }
            
            assert_eq!(parsed.method, "GET");
            assert_eq!(parsed.url, "https://seed-dev.ener-os.net/base/api/region/provinces");
            assert_eq!(parsed.headers.len(), 15);
        }
        Err(e) => {
            panic!("Full CMD format parsing failed: {}", e);
        }
    }
}

#[test]
fn test_bash_format_curl() {
    let bash_format = r#"curl 'https://seed-dev.ener-os.net/base/api/region/provinces' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Authorization: test123'"#;

    let result = parse_curl_command(bash_format);
    println!("Bash format result: {:?}", result);
    
    match result {
        Ok(parsed) => {
            println!("Method: {}", parsed.method);
            println!("URL: {}", parsed.url);
            println!("Headers: {:?}", parsed.headers);
            assert_eq!(parsed.method, "GET");
            assert_eq!(parsed.url, "https://seed-dev.ener-os.net/base/api/region/provinces");
            assert!(parsed.headers.len() > 0);
        }
        Err(e) => {
            panic!("Bash format parsing failed: {}", e);
        }
    }
}

#[test]
fn test_single_line_cmd() {
    let cmd = "curl -X POST \"https://example.com/api\" -H \"Content-Type: application/json\" -d \"{\\\"name\\\":\\\"test\\\"}\"";
    let result = parse_curl_command(cmd);
    println!("Single line CMD result: {:?}", result);
    
    match result {
        Ok(parsed) => {
            assert_eq!(parsed.method, "POST");
            assert_eq!(parsed.url, "https://example.com/api");
            assert!(parsed.body.is_some());
        }
        Err(e) => {
            panic!("Single line parsing failed: {}", e);
        }
    }
}