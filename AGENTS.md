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
├── http/           # send_http_request
└── memory/         # 记忆配置（集合展开状态等）
```

每个模块结构：`mod.rs (入口) + commands.rs + config.rs + utils.rs`

## 数据存储

| 文件 | 位置 | 内容 |
|------|------|------|
| `workspace.yaml` | `~/.fm/` | 所有工作区列表 |
| `collections.yaml` | `{工作区路径}/` | 集合和接口数据 |
| `environments.yaml` | `{工作区路径}/` | 环境变量 |
| `memory.yaml` | `{工作区路径}/` | 集合展开状态等记忆配置 |

## Tauri Commands

| 模块 | 命令 | 说明 |
|------|------|------|
| workspace | `get_workspaces`, `create_workspace`, `switch_workspace`, `delete_workspace`, `update_workspace` | 工作区 CRUD |
| workspace | `set_last_api`, `get_last_api` | 最后打开的接口 |
| collection | `get_collections`, `create_collection`, `create_api`, `update_api`, `update_collection`, `delete_collection_item`, `move_api` | 集合/接口 CRUD |
| environment | `get_environments`, `save_environment`, `delete_environment`, `switch_environment`, `get_active_variables` | 环境变量 |
| memory | `get_expanded_collections`, `save_expanded_collections` | 集合展开状态 |
| http | `send_http_request` | 发送 HTTP 请求（支持变量替换） |

## 添加新 Tauri Command

1. 选择模块：`workspace/`, `collection/`, `http/`, `environment/`, `memory/`
2. 在模块 `commands.rs` 添加 `#[tauri::command]` 函数
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