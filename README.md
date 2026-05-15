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
- **请求历史**：保存响应记录，方便对比和回顾

### 📁 集合管理
- **层级结构**：支持多层集合嵌套（最多 3 层），方便组织接口
- **拖拽排序**：支持同级拖拽排序和跨层级移动
- **集合变量**：集合级别的变量继承，支持 `{{variableName}}` 引用
- **公共请求头**：集合级别的公共请求头，自动应用到所有接口
- **环境变量**：支持多环境配置（开发、测试、生产等）

### ✨ 用户体验
- **变量高亮**：输入框中自动高亮显示变量引用
- **Toast 提示**：友好的操作提示和错误信息
- **自动格式化**：JSON/XML/HTML 自动格式化显示
- **Monaco Editor**：专业的代码编辑器体验

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
npm run tauri dev
```

### 构建发布

```bash
# 构建生产版本
npm run tauri build
```

或使用 GitHub Actions 自动构建：
1. 创建版本标签：`git tag v0.0.1`
2. 推送标签：`git push origin v0.0.1`
3. GitHub Actions 自动构建并发布到 Releases

## 技术栈

- **前端框架**：Vue 3 + Composition API
- **桌面框架**：Tauri 2.0
- **UI 组件**：自定义组件 + Monaco Editor
- **后端语言**：Rust
- **构建工具**：Vite
- **包管理**：npm

## 项目结构

```
fm-tester/
├── src/                    # Vue 前端代码
│   ├── components/         # Vue 组件
│   ├── composables/        # Vue Composition API hooks
│   └── utils/              # 工具函数
├── src-tauri/              # Rust 后端代码
│   ├── src/
│   │   ├── collection/     # 集合管理
│   │   ├── http/           # HTTP 请求处理
│   │   └── workspace/      # 工作空间管理
│   └── Cargo.toml          # Rust 依赖配置
├── .github/workflows/      # GitHub Actions CI/CD
└── package.json            # Node.js 项目配置
```

## License

MIT

## 作者

zhangwenlincn