# FM Tester

一个基于 Tauri + Vue 3 开发的 API 测试工具，类似于 Postman 的桌面应用。

## 功能特性

### 🚀 核心功能
- **接口测试**：支持 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS 等常用 HTTP 方法
- **请求配置**：
  - URL 参数（Query Parameters）
  - 请求头（Headers）
  - 请求体（Body）：支持 none、form-data、x-www-form-urlencoded、raw、binary 多种格式
  - Raw 编辑器：支持 JSON、Text、JavaScript、HTML、XML，带语法高亮和格式化
- **响应查看**：实时显示响应状态码、响应头、响应体（JSON/XML/HTML 格式化显示）
- **请求历史**：按日期存储请求记录，方便对比和回顾

### 📁 工作区管理
- **多工作区**：支持创建多个独立工作区，隔离不同项目的数据
- **快速切换**：快速在不同工作区之间切换
- **工作区设置**：每个工作区独立的集合、环境变量、脚本等配置

### 📂 集合管理
- **层级结构**：支持多层集合嵌套（最多 3 层），方便组织接口
- **拖拽排序**：支持同级拖拽排序和跨层级移动
- **集合变量**：集合级别的变量继承，支持 `{{variableName}}` 引用
- **公共请求头**：集合级别的公共请求头，自动应用到所有接口
- **集合设置**：为集合配置前置/后置脚本、变量、公共请求头

### 🔧 环境管理
- **多环境支持**：支持多环境配置（开发、测试、生产等）
- **环境变量**：URL/Headers/Body 支持 `{{变量名}}` 替换
- **环境切换**：快速切换不同环境，变量自动替换
- **环境脚本**：环境级别的前置/后置脚本

### 🤖 AI 助手
- **智能对话**：集成 AI 聊天功能，支持 OpenAI 协议 API
- **模型选择**：自动获取可用模型列表，或手动输入模型名称
- **对话历史**：保存聊天会话，支持历史查看和管理
- **多 API 支持**：兼容 OpenAI、Azure、本地部署等多种 API 端点
- **AI 辅助**：AI 生成 API 文档、优化脚本代码

### 📥 导入导出
- **OpenAPI 导入**：导入前预览 OpenAPI/Swagger 文档结构，一键导入所有接口
- **Postman 导入**：支持 Postman Collection 2.1 格式导入
- **Postman 导出**：导出集合为 Postman Collection 2.1 格式
- **curl 导入**：解析 curl 命令并创建接口
- **curl 导出**：将接口导出为 curl 命令，复制到剪贴板

### 🔀 Git 同步
- **云端同步**：工作区支持 Git 仓库同步，数据云端备份
- **自动检查**：可配置自动检查远程更新，定时提醒
- **分支管理**：支持切换 Git 分支，管理多个版本
- **凭据加密**：Git 凭据 AES-GCM 加密存储，安全可靠

### ⚡ 脚本引擎
- **前置脚本**：请求发送前执行，可修改请求参数
- **后置脚本**：响应返回后执行，可处理响应数据
- **控制台日志**：脚本执行日志实时显示，方便调试
- **fm API**：
  - `fm.environment.get/set` - 环境变量操作
  - `fm.collection.get/set` - 集合变量操作
  - `fm.request.*` - 请求参数修改（URL、Headers、Body）
  - `fm.response.*` - 响应数据访问
  - `fm.log/assert/sleep` - 工具方法
- **执行顺序**：前置脚本（工作区 → 环境 → 父集合 → 子集合 → 接口），后置脚本反向执行

### 🍪 Cookie 管理
- **自动管理**：自动保存响应中的 Cookie
- **手动编辑**：支持添加、编辑、删除 Cookie
- **请求携带**：发送请求时自动携带匹配的 Cookie

### 💾 数据保存
- **响应快照**：保存完整的请求/响应快照，方便对比
- **请求历史**：按日期分目录存储，便于追溯

### 🌐 国际化
- **多语言支持**：支持中文（简体）、英文
- **语言切换**：设置面板切换语言，自动保存

### ✨ 用户体验
- **变量高亮**：输入框中自动高亮显示变量引用
- **Toast 提示**：友好的操作提示和错误信息
- **自动格式化**：JSON/XML/HTML 自动格式化显示
- **Monaco Editor**：专业的代码编辑器体验
- **JSON5 支持**：编辑支持注释和尾逗号，发送时转换为标准 JSON

## 安装

从 [GitHub Releases](https://github.com/zhangwenlincn/fm-tester/releases) 下载对应平台的安装包：

### Windows
- 下载 `.msi` 或 `.exe` 安装包
- 双击安装

### macOS
- 下载 `.dmg` 文件
- 双击打开，拖拽到 Applications

### Linux
- 下载 `.deb` 或 `.AppImage` 文件
- `.deb`: `sudo dpkg -i fm-tester_*.deb`
- `.AppImage`: `chmod +x fm-tester_*.AppImage && ./fm-tester_*.AppImage`

## 开发

### 环境要求
- Node.js 20+
- Rust stable
- pnpm 或 npm

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
cargo tauri dev
```

### 验证编译

```bash
cd src-tauri
cargo check
```

### 构建发布

```bash
cargo tauri build
```

或使用 GitHub Actions 自动构建：
1. 创建版本标签：`git tag v0.0.1`
2. 推送标签：`git push origin v0.0.1`
3. GitHub Actions 自动构建并发布到 Releases

## 技术栈

- **前端框架**：Vue 3 + Composition API
- **桌面框架**：Tauri 2.0
- **UI 组件**：自定义组件 + Monaco Editor（纯原生 CSS，无 UI 框架）
- **国际化**：vue-i18n
- **后端语言**：Rust
- **HTTP 客户端**：reqwest
- **构建工具**：Vite 6
- **包管理**：npm

## 项目结构

```
fm-tester/
├── src/                          # Vue 前端代码
│   ├── assets/                   # 静态资源
│   ├── components/               # Vue 组件
│   │   ├── AISettingsPanel/     # AI 设置面板
│   │   ├── ChatPanel/           # AI 聊天面板
│   │   ├── CollectionSettingsPanel/  # 集合设置面板
│   │   ├── ConsolePanel/        # 控制台面板（脚本日志）
│   │   ├── CookiePanel/         # Cookie 管理面板
│   │   ├── CurlImportDialog/    # curl 导入对话框
│   │   ├── DocPanel/            # 文档面板
│   │   ├── EnvironmentPanel/    # 环境变量面板
│   │   ├── HeaderAutocomplete/  # 请求头自动补全
│   │   ├── HistoryDetailPanel/  # 历史详情面板
│   │   ├── Icon/                # 图标组件
│   │   ├── ImportDialog/        # OpenAPI/Postman 导入对话框
│   │   ├── MenuBar/             # 菜单栏
│   │   ├── RequestPanel/        # 请求配置面板
│   │   ├── ResponsePanel/       # 响应查看面板
│   │   ├── SavedResponseDetail/ # 保存的响应详情
│   │   ├── SaveResponseDialog/  # 保存响应对话框
│   │   ├── ScriptPanel/         # 脚本编辑面板
│   │   ├── SettingsPanel/       # 全局设置面板
│   │   ├── Sidebar/             # 侧边栏（集合列表、环境、历史等）
│   │   ├── StatusBar/           # 状态栏
│   │   ├── TabsBar/             # 标签页栏
│   │   ├── Toast/               # Toast 提示组件
│   │   ├── VariableHighlight/   # 变量高亮组件
│   │   ├── WorkspaceDialog/     # 工作区对话框
│   │   └── WorkspaceSettingsPanel/  # 工作区设置面板
│   ├── composables/             # Vue Composition API hooks
│   │   ├── useEnvironment.js    # 环境变量管理
│   │   ├── useGitUpdateChecker.js  # Git 更新检查
│   │   ├── useI18n.js           # 国际化
│   │   ├── useRequest.js        # 请求管理
│   │   ├── useResponse.js       # 响应处理
│   │   ├── useSettings.js       # 全局设置
│   │   ├── useTabs.js           # 标签页管理
│   │   ├── useToast.js          # Toast 提示
│   │   └── useWorkspace.js      # 工作区管理
│   ├── i18n/                    # 国际化配置
│   ├── locales/                 # 语言包（zh-CN.json, en.json）
│   └── utils/                   # 工具函数
│       ├── scriptEngine.js      # 脚本执行引擎
│       └── syntax-highlight.js  # 语法高亮
├── src-tauri/                    # Rust 后端代码
│   ├── src/
│   │   ├── ai/                  # AI API 调用（获取模型列表）
│   │   ├── chat/                # AI 聊天（对话历史管理）
│   │   ├── collection/          # 集合/接口 CRUD
│   │   ├── cookie/              # Cookie 管理
│   │   ├── environment/         # 环境变量 CRUD + 变量替换
│   │   ├── file_dialog/         # 文件对话框
│   │   ├── git/                 # Git 同步、凭据加密、分支管理
│   │   ├── history/             # 请求历史记录（按日期分目录）
│   │   ├── http/                # HTTP 请求发送（自动记录历史）
│   │   ├── import/              # OpenAPI 导入
│   │   ├── md/                  # API 文档管理
│   │   ├── memory/              # 记忆配置（集合展开状态等）
│   │   ├── models.rs            # 数据结构定义
│   │   ├── saved_response/      # 保存的响应快照
│   │   ├── script/              # 前置/后置脚本管理
│   │   ├── settings/            # 全局设置（超时、语言、AI配置）
│   │   └── workspace/           # 工作区 CRUD
│   └── Cargo.toml               # Rust 依赖配置
├── .github/workflows/            # GitHub Actions CI/CD
└── package.json                  # Node.js 项目配置
```

## License

MIT

## 作者

zhangwenlincn