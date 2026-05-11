# FM Tester 项目指南

## 技术栈

- **前端**: Vue 3 (script setup) + Vite 6
- **后端**: Tauri 2 + Rust
- **纯原生实现**: 无 UI 框架，所有样式手写 CSS

## 目录结构

```
fm-tester/
├── src/                    # Vue 前端
│   ├── App.vue             # 主布局入口
│   ├── main.js             # Vue 应用入口
│   └── components/         # UI 组件
│       ├── MenuBar.vue     # 顶部菜单栏
│       ├── TabsBar.vue     # 标签页系统
│       ├── Sidebar.vue     # 左侧导航 + 树形列表
│       ├── RequestPanel.vue # 请求区（URL/请求体）
│       ├── ResponsePanel.vue # 响应区
│       └── StatusBar.vue   # 底部状态栏
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # 二进制入口
│   │   └── lib.rs          # Tauri 应用定义 + commands
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── package.json            # npm 依赖
├── vite.config.js          # Vite 配置
└── index.html              # HTML 入口
```

## 开发命令

```bash
# 启动 Tauri 开发模式（前端 + 后端）
cargo tauri dev

# 仅启动 Vite 前端开发服务器
npm run dev

# 构建生产版本
cargo tauri build

# 构建 Vue 前端（单独）
npm run build
```

## 关键配置

### Vite (vite.config.js)

- **端口**: 1420 (strictPort, 不可更改)
- **热重载**: 端口 1421 (仅 TAURI_DEV_HOST 环境下)
- **忽略监听**: src-tauri 目录

### Tauri (tauri.conf.json)

- **开发服务器**: http://localhost:1420
- **构建前命令**: `npm run build`
- **前端产物**: `../dist`
- **窗口默认**: 800x600
- **identifier**: `com.administrator.fm-tester`

### Cargo.toml 注意事项

Windows 上 lib crate 使用 `_lib` suffix 防止命名冲突：
```toml
[lib]
name = "fm_tester_lib"  # 注意 _lib suffix
crate-type = ["staticlib", "cdylib", "rlib"]
```

## 组件架构

```
App.vue
├── MenuBar.vue      (顶部菜单)
├── TabsBar.vue      (标签页 + 环境选择)
├── Sidebar.vue      (左侧导航 + 集合树)
│   └── emit('selectApi') → App.vue
├── RequestPanel.vue (请求配置)
│   └── emit('sendRequest') → App.vue
├── ResponsePanel.vue(响应显示)
└── StatusBar.vue    (状态栏)
```

**数据流**:
- `App.vue` 管理全局状态：tabs, currentRequest, response
- 子组件通过 emit 与父组件通信
- HTTP 请求在 App.vue 的 `sendRequest()` 中执行

## 添加 Tauri Command

1. 在 `src-tauri/src/lib.rs` 添加：
```rust
#[tauri::command]
fn my_command(arg: &str) -> String {
    // 实现
}
```

2. 注册到 `invoke_handler`:
```rust
.invoke_handler(tauri::generate_handler![greet, my_command])
```

3. 前端调用：
```js
import { invoke } from '@tauri-apps/api/core'
const result = await invoke('my_command', { arg: 'value' })
```

## 推荐 IDE

- VS Code + Vue.volar + tauri-apps.tauri-vscode + rust-lang.rust-analyzer

## HTTP 颜色方案

- POST: `#FA8C16` (橙色)
- GET: `#52C416` (绿色)
- PUT: `#1890FF` (蓝色)
- DELETE: `#F5222D` (红色)
- 强调色: `#1890FF`
- 选中高亮: `#E6F7FF`