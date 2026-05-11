# FM Tester 项目指南

## 技术栈

- **前端**: Vue 3 (script setup + composables) + Vite 6
- **后端**: Tauri 2 + Rust (模块化结构)
- **纯原生实现**: **禁止使用任何 UI 框架**（Ant Design, Element 等），所有样式手写 CSS
- **HTTP 客户端**: reqwest (Rust 后端发送请求，绕过 CORS)
- **代码编辑**: Monaco Editor (请求体和响应体编辑器)
- **语法支持**: JSON5 (编辑时支持注释/单引号/尾逗号，发送时转换为标准 JSON)

## 用户明确约束

**必须遵守**：
- ❌ **禁止使用 UI 框架** - 使用纯原生 Vue 3 + CSS
- ✅ **使用 cargo 命令** - 开发命令为 `cargo tauri dev`，不是 `npm run dev`
- ❌ **禁止主动 git push** - 只有用户明确要求时才推送
- ✅ **集合最多三层** - `MAX_DEPTH = 2` (depth 0, 1, 2)
- ✅ **新建接口无需输入名称** - 直接在 request 页面让用户填写
- ✅ **重命名自动保存** - 修改名称后立即保存到后端
- ✅ **组件文件夹结构** - 每个组件必须有 `index.vue + index.js + style.css` 三文件

## 目录结构

```
fm-tester/
├── src/                    # Vue 前端
│   ├── App.vue             # 主布局入口
│   ├── App.js              # App composable (状态管理)
│   ├── main.js             # Vue 应用入口
│   └── components/         # UI 组件 (每个组件独立文件夹)
│       ├── Icon/
│       │   ├── index.vue   # 组件模板
│       │   └── style.css   # 组件样式
│       ├── Sidebar/
│       │   ├── index.vue
│       │   ├── index.js    # composable
│       │   └── style.css
│       ├── RequestPanel/
│       ├── ResponsePanel/
│       ├── TabsBar/
│       ├── MenuBar/
│       ├── StatusBar/
│       └── WorkspaceDialog/
├── src-tauri/              # Rust 后端 (模块化)
│   ├── src/
│   │   ├── lib.rs          # 入口：注册所有命令
│   │   ├── main.rs         # 二进制入口
│   │   ├── models.rs       # 数据结构定义
│   │   ├── workspace/      # 工作区模块
│   │   │   └── mod.rs      # CRUD 命令
│   │   ├── collection/     # 集合模块
│   │   │   └── mod.rs      # 集合/接口 CRUD
│   │   └── http/           # HTTP 模块
│   │   │   └── mod.rs      # send_http_request
│   ├── Cargo.toml
│   ├── capabilities/       # Tauri 权限配置
│   └── tauri.conf.json
```

## 数据存储

- **工作区配置**: `~/.fm/workspace.yaml` (所有工作区列表)
- **集合配置**: `{工作区路径}/collections.yaml` (集合和接口数据)
- **字段命名**: YAML 中使用 `type` 字段（Rust 有 `#[serde(rename = "type")]`）

## 开发命令

```bash
# 启动 Tauri 开发模式（前端 + 后端）
cargo tauri dev

# 仅启动 Vite 前端
npm run dev

# 验证 Rust 编译
cd src-tauri && cargo check

# 构建生产版本
cargo tauri build
```

## 关键配置

### Vite (vite.config.js)

- **端口**: 1420 (strictPort, 固定不可改)
- **忽略监听**: src-tauri 目录

### Cargo.toml 注意事项

Windows 上 lib crate 使用 `_lib` suffix 防止命名冲突：
```toml
[lib]
name = "fm_tester_lib"  # 必须 _lib suffix
crate-type = ["staticlib", "cdylib", "rlib"]
```

### 权限 (capabilities/default.json)

```json
"permissions": [
  "core:default",
  "opener:default",
  "fs:default",
  "fs:allow-home-read",
  "fs:allow-home-write-recursive",
  "dialog:default"
]
```

## Rust 模块结构

```rust
// lib.rs 入口
mod models;
mod workspace;
mod collection;
mod http;

pub use models::*;
pub use workspace::*;  // 导出所有 workspace 命令
pub use collection::*;
pub use http::*;

// 注册命令
.invoke_handler(tauri::generate_handler![
    get_workspaces, create_workspace, switch_workspace, ...
    get_collections, create_collection, create_api, ...
    send_http_request
])
```

## Tauri Commands

| 模块 | 命令 | 说明 |
|------|------|------|
| workspace | `get_workspaces` | 获取所有工作区 |
| workspace | `get_last_workspace` | 获取最近打开的工作区 |
| workspace | `create_workspace` | 创建工作区 |
| workspace | `switch_workspace` | 切换工作区 |
| workspace | `set_last_api` | 设置最后打开的接口 |
| workspace | `get_last_api` | 获取最后打开的接口 |
| collection | `get_collections` | 获取集合列表 |
| collection | `create_collection` | 创建集合 |
| collection | `create_api` | 创建接口 |
| collection | `update_api` | 更新接口信息 |
| collection | `update_collection` | 更新集合名称 |
| collection | `delete_collection_item` | 删除集合或接口 |
| http | `send_http_request` | 发送 HTTP 请求 |

## 前端调用模式

```js
import { invoke } from '@tauri-apps/api/core'

// 调用 Tauri 命令
const result = await invoke('get_workspaces')
const api = await invoke('create_api', {
  workspacePath: workspace.path,
  name: '接口名称',
  method: 'GET',
  url: '',
  parentId: parent?.id
})

// HTTP 请求（通过 Rust 后端，绕过 CORS）
const response = await invoke('send_http_request', {
  method: 'GET',
  url: 'https://www.baidu.com',
  headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
  body: null
})
```

## Vue 组件模式

每个组件使用文件夹结构 + composable：

```js
// components/Sidebar/index.vue
import { useSidebarSetup } from './index.js'

const { loadWorkspaces, loadCollections } = useSidebarSetup(props, emit)
```

```js
// components/Sidebar/index.js - composable
export function useSidebarSetup(props, emit) {
  const collections = ref([])
  
  const loadCollections = async () => {
    collections.value = await invoke('get_collections', { workspacePath: props.workspace.path })
  }
  
  return { collections, loadCollections }
}
```

## 添加新的 Tauri Command

1. 选择合适模块：`workspace/`, `collection/`, `http/`
2. 在模块 `mod.rs` 中添加：
```rust
#[tauri::command]
pub fn my_command(arg: String) -> Result<String, String> {
    Ok(format!("result: {}", arg))
}
```
3. 在 `lib.rs` 注册到 `invoke_handler`

## HTTP 颜色方案

- POST: `#FA8C16` (橙色)
- GET: `#52C416` (绿色)
- PUT: `#1890FF` (蓝色)
- DELETE: `#FF4D4F` (红色)
- PATCH: `#722ED1` (紫色)

## 注意事项

**开发约束**:
- ❌ **禁止使用 UI 框架** (Ant Design, Element 等)
- ❌ **禁止使用 pip** - Python 依赖用 uv 管理
- ❌ **禁止主动 Git push** - 只在用户明确请求时推送
- ✅ **使用 cargo 命令** - 开发用 `cargo tauri dev`，不用 `npm run dev`
- ✅ **集合最多三层嵌套** - MAX_DEPTH = 2 (Sidebar/index.js 第 15 行)

**交互逻辑**:
- ✅ **新建接口** - 直接打开请求面板，不需要对话框输入信息
- ✅ **重命名自动保存** - 调用后端 update_api/update_collection
- ✅ **删除同步** - 删除接口时关闭对应标签页，删除集合时关闭所有子接口标签页
- ✅ **URL 参数同步** - URL 输入和参数面板双向同步（RequestPanel/index.js）
- ✅ **Content-Type 自动适配** - 选择请求体类型时自动添加/更新 Content-Type 请求头

**JSON5 特殊处理**:
- ✅ **编辑支持 JSON5** - Monaco Editor 使用 json5 语言（支持注释、单引号、尾逗号）
- ✅ **格式化输出标准 JSON** - formatJson 函数输出标准格式（所有 key 必须有双引号）
- ✅ **发送时转换** - sendRequest 函数自动将 JSON5 转换为标准 JSON 发送
- 位置: App.js 第 222-237 行, syntax-highlight.js 第 248-262 行

**组件结构要求**:
- ✅ 每个组件必须有三个文件: `index.vue + index.js + style.css`
- ✅ Composable 模式: index.js 导出 setup 函数，index.vue 导入并使用

## 窗口配置

- 默认尺寸: 1280 × 800
- 最小尺寸: 800 × 600
- 配置位置: src-tauri/tauri.conf.json

## 数据模型

### Collection (集合/接口)
```rust
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "type")]
    pub type: String,  // "collection" 或 "api"
    pub children: Vec<Collection>,
    pub method: String,
    pub url: String,
    pub headers: Vec<Header>,
    pub body: String,
    pub body_type: String,
}
```

### Workspace (工作区)
```rust
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub created_at: String,
    pub last_opened: String,
    pub last_api_id: Option<String>,
}
```