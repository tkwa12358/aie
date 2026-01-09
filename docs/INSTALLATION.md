# 安装指南

本文档介绍如何在本地环境中安装和配置AI English Studio。

## 系统要求

### 最低要求
- **Node.js**: 20.0.0 或更高版本
- **npm**: 10.0.0 或更高版本
- **内存**: 至少 4GB RAM
- **磁盘空间**: 至少 2GB 可用空间

### 推荐配置
- **Node.js**: 20.x LTS
- **内存**: 8GB RAM 或更多
- **磁盘空间**: 5GB 或更多（包含词库数据）

### 可选依赖
- **Docker**: 24.0 或更高版本（用于容器部署）
- **Git**: 2.30 或更高版本（用于源码管理）

## 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url> ai-english-studio
cd ai-english-studio
```

### 2. 环境配置

#### 复制环境变量模板
```bash
cp .env.example .env
```

#### 配置环境变量
编辑 `.env` 文件，设置必要的配置：

```bash
# 必需配置
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters
JWT_EXPIRES_IN=7d
PORT=3000

# 数据库配置
DATA_DIR=./backend/database
UPLOAD_DIR=./backend/uploads

# 可选配置
BAIDU_APP_ID=your-baidu-app-id
BAIDU_API_KEY=your-baidu-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 3. 安装依赖

#### 方式一：统一安装（推荐）
```bash
npm run install:all
```

#### 方式二：分别安装
```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
npm install

# 安装测试依赖
cd ../tests
npm install
```

### 4. 创建必要目录

```bash
# 创建后端数据目录
mkdir -p backend/database
mkdir -p backend/uploads

# 设置权限（Linux/macOS）
chmod 755 backend/database
chmod 755 backend/uploads
```

## 开发环境启动

### 方式一：并发启动（推荐）
```bash
npm run dev
```
这将同时启动前端和后端开发服务器。

### 方式二：分别启动
```bash
# 终端1 - 启动后端服务
npm run dev:backend

# 终端2 - 启动前端服务
npm run dev:frontend
```

### 访问应用
- **前端**: http://localhost:8080
- **后端API**: http://localhost:3001/api
- **API文档**: http://localhost:3001/api/health（健康检查）

## 数据库初始化

### 自动初始化
首次启动后端时，系统会自动创建SQLite数据库和必要的表结构。

### 手动初始化（如果需要）
```bash
cd backend
npm run migrate
```

### 默认管理员账号
- **邮箱**: admin@163.com
- **密码**: admin@163.com

## 常见问题

### 1. 端口冲突

如果端口3000或8080被占用，可以修改配置：

**修改后端端口**：
```bash
# .env 文件中
PORT=3001
```

**修改前端端口**：
```bash
# frontend/vite.config.ts 中
server: {
  port: 8081
}
```

### 2. 权限问题

**Linux/macOS 权限错误**：
```bash
sudo chown -R $(whoami) backend/database
sudo chown -R $(whoami) backend/uploads
```

**Windows 权限错误**：
以管理员身份运行终端，或检查文件夹权限。

### 3. 依赖安装失败

**清理缓存**：
```bash
npm cache clean --force
rm -rf node_modules */node_modules
npm run install:all
```

**网络问题**：
```bash
# 使用国内镜像
npm config set registry https://registry.npmmirror.com
npm run install:all
```

### 4. SQLite 权限问题

确保数据目录有读写权限：
```bash
ls -la backend/database/
# 应该显示可读写权限
```

## 开发工具配置

### VS Code 推荐插件

创建 `.vscode/extensions.json`：
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "ms-playwright.playwright"
  ]
}
```

### 调试配置

创建 `.vscode/launch.json`：
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/app.ts",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"]
    }
  ]
}
```

## 下一步

安装完成后，您可以：

1. **开始开发**: 阅读 [开发指南](docs/DEVELOPMENT.md)
2. **部署应用**: 查看 [部署指南](DEPLOYMENT.md)
3. **运行测试**: 执行 `npm test`
4. **查看API**: 访问 http://localhost:3001/api

## 获取帮助

- **文档**: 查看 [README.md](README.md)
- **变更日志**: 查看 [CHANGELOG.md](CHANGELOG.md)
- **问题反馈**: 提交 Issue 到项目仓库

## 疑难解答

如果遇到问题，请按以下步骤排查：

1. **检查Node.js版本**: `node --version`（应该 ≥ 20.0.0）
2. **检查npm版本**: `npm --version`（应该 ≥ 10.0.0）
3. **检查环境变量**: 确认 `.env` 文件配置正确
4. **检查端口占用**: `netstat -tlnp | grep :3000`
5. **检查日志**: 查看终端输出的错误信息
6. **重新安装**: 删除 `node_modules` 后重新安装

如果问题仍然存在，请提交详细的错误信息和环境配置到项目 Issue。