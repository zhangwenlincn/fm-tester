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

### 📁 集合管理
- **层级结构**：支持多层集合嵌套（最多 3 层），方便组织接口
- **拖拽排序**：支持同级拖拽排序和跨层级移动
- **集合变量**：集合级别的变量继承，支持 `{{variableName}}` 引用
- **公共请求头**：集合级别的公共请求头，自动应用到所有接口

### 🔧 环境管理
- **多环境支持**：支持多环境配置（开发、测试、生产等）
- **环境变量**：URL/Headers/Body 支持 `{{变量名}}` 替换
- **环境切换**：快速切换不同环境，变量自动替换

### 🤖 AI 助手
- **智能对话**：集成 AI 聊天功能，支持 OpenAI 协议 API
- **模型选择**：自动获取可用模型列表，或手动输入模型名称
- **对话历史**：保存聊天会话，支持历史查看和管理
- **多 API 支持**：兼容 OpenAI、Azure、本地部署等多种 API 端点

### 🔀 Git 同步
- **云端同步**：工作区支持 Git 仓库同步，数据云端备份
- **自动检查**：可配置自动检查远程更新，定时提醒
- **分支管理**：支持切换 Git 分支，管理多个版本
- **凭据加密**：Git 凭据 AES-GCM 加密存储，安全可靠

### ⚡ 脚本引擎
- **前置脚本**：请求发送前执行，可修改请求参数
- **后置脚本**：响应返回后执行，可处理响应数据
- **fm API**：
  - `fm.environment.get/set` - 环境变量操作
  - `fm.collection.get/set` - 集合变量操作
  - `fm.request.*` - 请求参数修改（URL、Headers、Body）
  - `fm.response.*` - 响应数据访问
  - `fm.log/assert/sleep` - 工具方法
- **执行顺序**：继承链执行（工作区 → 集合 → 接口）

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
│   ├── components/               # Vue 组件
│   │   ├── ChatPanel/           # AI 聊天面板
│   │   ├── RequestPanel/        # 请求配置面板
│   │   ├── ResponsePanel/       # 响应查看面板
│   │   ├── SettingsPanel/       # 全局设置面板
│   │   ├── ScriptPanel/         # 脚本编辑面板
│   │   └── Sidebar/             # 侧边栏组件
│   ├── composables/             # Vue Composition API hooks
│   ├── i18n/                    # 国际化配置
│   ├── locales/                 # 语言包
│   └── utils/                   # 工具函数
├── src-tauri/                    # Rust 后端代码
│   ├── src/
│   │   ├── ai/                  # AI API 调用
│   │   ├── chat/                # AI 聊天管理
│   │   ├── collection/          # 集合管理
│   │   ├── environment/         # 环境变量管理
│   │   ├── git/                 # Git 同步管理
│   │   ├── http/                # HTTP 请求处理
│   │   ├── script/              # 脚本引擎
│   │   ├── settings/            # 全局设置
│   │   └── workspace/           # 工作空间管理
│   └── Cargo.toml               # Rust 依赖配置
├── .github/workflows/            # GitHub Actions CI/CD
└── package.json                  # Node.js 项目配置
```

## License

MIT

## 作者

zhangwenlincn