# FM Tester 项目指南

## 技术栈

- **前端**: Vue 3 (script setup + composables) + Vite 6
- **后端**: Tauri 2 + Rust (模块化结构)
- **纯原生实现**: **禁止使用任何 UI 框架**，所有样式手写 CSS
- **HTTP 客户端**: reqwest (Rust 后端发送请求，绕过 CORS)
- **代码编辑**: Monaco Editor
- **语法支持**: JSON5 (编辑时支持注释/尾逗号，发送时转换为标准 JSON)

## 用户约束（必须遵守）

- ❌ **禁止使用 UI 框架** (Ant Design, Element 等)
- ❌ **禁止主动 git push** - 只有用户明确要求时才推送
- ❌ **禁止 AI 启动程序** - 不运行 `cargo tauri dev` 等，仅进行代码编辑
- ✅ **使用 cargo 命令** - 开发用 `cargo tauri dev`，不用 `npm run dev`
- ✅ **集合最多三层** - `MAX_DEPTH = 2` (CollectionPanel/index.js)
- ✅ **组件三文件结构** - `index.vue + index.js + style.css`

## 开发命令

```bash
cargo tauri dev      # 启动开发模式（前端 + 后端）
cd src-tauri; cargo check  # 验证 Rust 编译
cargo tauri build    # 构建生产版本
```

## Rust 后端模块

```
src-tauri/src/
├── lib.rs          # 入口：注册所有命令
├── models.rs       # 数据结构定义
├── workspace/      # 工作区 CRUD
├── collection/     # 集合/接口 CRUD
├── environment/    # 环境变量 CRUD + 变量替换
├── http/           # send_http_request（自动记录历史、处理 Cookie）
├── memory/         # 记忆配置（集合展开状态等）
├── cookie/         # Cookie 管理
├── history/        # 请求历史记录（按日期分目录存储）
└── saved_response/ # 保存的响应快照
```

每个模块结构：`mod.rs (入口) + {module}_commands.rs + {module}_config.rs (+ {module}_utils.rs 可选)`

## 数据存储

| 文件/目录 | 位置 | 内容 |
|------|------|------|
| `workspace.yaml` | `~/.fm/` | 所有工作区列表 |
| `collections.yaml` | `{工作区路径}/` | 集合和接口数据 |
| `environments.yaml` | `{工作区路径}/` | 环境变量 |
| `memory.yaml` | `{工作区路径}/` | 集合展开状态、打开的标签页 |
| `cookies.yaml` | `{工作区路径}/` | Cookie 存储 |
| `history/{日期}/` | `{工作区路径}/` | 每日请求历史（按日期分目录） |
| `saved_responses/` | `{工作区路径}/` | 保存的响应快照 |

## Tauri Commands

| 模块 | 命令 | 说明 |
|------|------|------|
| workspace | `get_workspaces`, `get_last_workspace`, `create_workspace`, `switch_workspace`, `delete_workspace`, `update_workspace`, `set_last_workspace` | 工作区 CRUD |
| workspace | `set_last_api`, `get_last_api` | 最后打开的接口 |
| collection | `get_collections`, `create_collection`, `create_api`, `update_api`, `update_collection`, `update_collection_settings`, `delete_collection_item`, `move_api` | 集合/接口 CRUD |
| environment | `get_environments`, `save_environment`, `delete_environment`, `switch_environment`, `get_active_variables` | 环境变量 |
| memory | `get_expanded_collections`, `save_expanded_collections`, `get_open_tabs`, `save_open_tabs` | 集合展开状态、打开的标签页 |
| http | `send_http_request` | 发送 HTTP 请求（支持变量替换、form-data、binary、自动记录历史） |
| cookie | `get_cookies`, `clear_cookies`, `delete_cookie`, `add_cookie` | Cookie 管理 |
| saved_response | `save_response`, `get_saved_responses`, `get_saved_response`, `delete_saved_response`, `get_api_saved_responses` | 保存的响应快照 |
| history | `get_history_dates`, `get_history_by_date`, `get_history_entry`, `delete_history_entry`, `clear_history_by_date`, `clear_all_history` | 请求历史记录 |

## 添加新 Tauri Command

1. 选择模块：`workspace/`, `collection/`, `http/`, `environment/`, `memory/`
2. 在模块 `{module}_commands.rs` 添加 `#[tauri::command]` 函数
3. 在模块 `mod.rs` 导出
4. 在 `lib.rs` 注册到 `invoke_handler`

## 前端调用

```js
import { invoke } from '@tauri-apps/api/core'

// 参数名使用 camelCase (Rust 会自动转换为 snake_case)
const result = await invoke('get_collections', { workspacePath: path })
const response = await invoke('send_http_request', {
  method: 'GET',
  url: '{{baseUrl}}/api',  // 支持 {{变量名}} 替换
  headers: [{ key: 'Authorization', value: 'Bearer {{token}}', enabled: true }],
  body: null,
  workspacePath: workspace.path
})
```

## Vue 组件模式

每个组件文件夹：`index.vue` + `index.js` (composable) + `style.css`

```js
// index.vue
import { useComponentSetup } from './index.js'
const { data, method } = useComponentSetup(props, emit)

// index.js
export function useComponentSetup(props, emit) {
  const data = ref([])
  return { data, method: async () => { ... } }
}
```

## 关键交互逻辑

- **新建接口** - 直接打开请求面板，无需对话框
- **重命名自动保存** - 修改后立即调用后端
- **删除同步** - 删除接口时关闭对应标签页，删除集合时关闭所有子接口标签页
- **环境变量** - URL/Headers/Body 支持 `{{变量名}}`，发送时自动替换
- **JSON5** - 编辑支持注释/尾逗号，发送时转换为标准 JSON

## HTTP 方法颜色

- GET: `#52C416`, POST: `#FA8C16`, PUT: `#1890FF`, DELETE: `#FF4D4F`, PATCH: `#722ED1`

## Cargo.toml 注意

Windows 上 lib crate 必须使用 `_lib` suffix：
```toml
[lib]
name = "fm_tester_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

## 窗口配置

- 默认: 1280×800, 最小: 800×600 (tauri.conf.json)

## Vite 配置注意

Monaco Editor 必须排除优化依赖，否则会出错：
```js
// vite.config.js
optimizeDeps: { exclude: ['monaco-editor'] }
```

## HTTP 请求日志事件

`send_http_request` 通过 `app.emit('http-log', log)` 发送日志到前端，前端监听：
```js
import { listen } from '@tauri-apps/api/event'
const unlisten = await listen('http-log', (event) => {
  // event.payload: { logType, timestamp, message, data, error }
})
```

日志类型：`request`, `response`, `error`, `warning`（未定义变量警告）