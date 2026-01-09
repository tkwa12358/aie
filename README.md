# AI English Studio

AI English Studio 是一个专为英语口语学习设计的在线学习平台，支持视频学习、跟读练习、单词本等功能。

## 功能特性

- 📹 **视频学习** - 支持双语字幕的视频播放和学习进度跟踪
- 🗣️ **跟读练习** - 专业级语音评测，提供发音评分和反馈
- 📚 **单词本** - 收藏生词，支持复习和掌握度跟踪
- 📊 **学习统计** - 详细的学习进度、时长和成就统计
- 📁 **本地学习** - 支持上传本地视频和字幕进行学习
- 👨‍💼 **管理后台** - 视频、用户、分类、授权码管理

## 技术栈

### 前端
- React 18.3 + TypeScript
- Vite (开发服务器)
- Tailwind CSS + shadcn/ui
- TanStack Query (数据获取)
- React Router (路由)

### 后端
- Express.js + TypeScript
- SQLite (sql.js)
- JWT 认证
- Multer (文件上传)

### 测试
- Playwright (E2E 测试)
- 86% 测试覆盖率

## 快速开始

### 前提条件
- Node.js 20+
- Docker (可选)

### 本地开发

1. 安装依赖
```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd ../backend
npm install
```

2. 启动开发服务器
```bash
# 后端服务 (端口 3001)
cd backend
npm run dev

# 前端服务 (端口 8080)
cd frontend
npm run dev
```

3. 访问应用
- 前端: http://localhost:8080
- 后端API: http://localhost:3001/api

### Docker部署

```bash
# 构建并启动容器
docker-compose up -d --build

# 访问应用
http://localhost:3000
```

## 项目结构

```
aie/
├── frontend/              # React前端应用
│   ├── src/
│   │   ├── components/    # 组件（按功能模块组织）
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API服务
│   │   └── types/         # TypeScript类型
│   └── package.json
├── backend/               # Express后端API
│   ├── src/
│   │   ├── controllers/   # 路由控制器
│   │   ├── middleware/    # 中间件
│   │   ├── models/        # 数据模型
│   │   └── services/      # 业务逻辑
│   └── package.json
├── tests/                 # E2E测试
└── docs/                  # 文档
```

## 环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
# JWT认证
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# 服务端口
PORT=3000

# 数据库
DATA_DIR=./backend/database

# 文件上传
UPLOAD_DIR=./backend/uploads
MAX_FILE_SIZE=500000000

# 翻译服务（可选）
BAIDU_APP_ID=your-app-id
BAIDU_API_KEY=your-api-key

# 语音评测（可选）
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=eastasia
```

## API文档

主要API端点：

- `/api/auth` - 用户认证
- `/api/videos` - 视频管理
- `/api/learning` - 学习进度
- `/api/words` - 单词本
- `/api/categories` - 分类管理
- `/api/assessment` - 语音评测
- `/api/admin` - 管理操作

## 测试

```bash
# 运行所有E2E测试
npm test

# UI模式
npm run test:ui

# 调试模式
npm run test:debug

# 查看测试报告
npm run test:report
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。