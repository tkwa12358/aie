# 更新日志

本文档记录AI English Studio项目的所有重要变更。

## [Unreleased]

### 🐛 修复

- **移动端录音启动**: 调整WebAudio录音启动顺序并补充静音输出，提升手机端录音稳定性
- **移动端录音兼容**: iOS Safari 优先使用MediaRecorder并加入AudioSession配置，失败时回退WebAudio
- **移动端跟读暂停**: 学习页统一单一播放器实例，避免隐藏播放器继续播放导致叠音
- **移动端顶栏遮挡**: 为页面预留顶栏安全空间并调整粘性区域偏移，避免内容被遮挡（预留高度调至 40px）
- **移动端字幕悬浮条**: 移除播放时的黑色悬浮字幕条，避免遮挡视频与列表
- **专业评测服务**: 接入真实评测调用与自动降级，新增服务商告警日志与后台删除功能
- **腾讯 SOE 请求**: 移除 `X-TC-Region` 请求头并补齐 `IsEnd`、`SessionId`、`SeqId`、`UserVoiceData`、`VoiceFileType=3`、`X-TC-Version=2018-07-24`
- **错误日志落盘**: 评测相关错误写入 `backend/logs/error.log`，方便后台实时监控

## [2.0.0] - 2026-01-09

### 重大变更 - 项目架构重构

这是AI English Studio的重大版本更新，我们对整个项目进行了架构重构，创建了一个优化、清洁的新版本。

### ✨ 新增功能

- **前后端分离架构**: 重新组织项目为清晰的前后端分离结构
- **模块化组件系统**: 按功能模块重新组织前端组件
- **优化的构建系统**: 独立的前端和后端构建流程
- **改进的Docker部署**: 多阶段构建和更好的容器化支持

### 🏗️ 项目结构优化

#### 新的目录结构
```
aie/
├── frontend/              # React前端应用
│   ├── src/
│   │   ├── components/    # 按功能模块组织的组件
│   │   │   ├── ui/        # 基础UI组件（精简至15-20个）
│   │   │   ├── video/     # 视频相关组件
│   │   │   ├── wordbook/  # 单词本组件
│   │   │   ├── practice/  # 跟读练习组件
│   │   │   ├── auth/      # 认证组件
│   │   │   └── admin/     # 管理后台组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API服务层
│   │   └── types/         # TypeScript类型定义
│   └── package.json
├── backend/               # Express后端API
│   ├── src/
│   │   ├── controllers/   # 路由控制器
│   │   ├── middleware/    # 中间件
│   │   ├── models/        # 数据模型
│   │   └── services/      # 业务逻辑
│   └── package.json
└── tests/                 # E2E测试
```

### 🧹 代码清理

#### UI组件优化
- **删除未使用的组件**: 从46个减少到15-20个必需组件
- **移除的组件**: accordion, alert-dialog, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, collapsible, command, context-menu, drawer, hover-card, input-otp, menubar, navigation-menu, pagination, popover, radio-group, resizable, scroll-area, sheet, sidebar, skeleton, slider, switch, toggle, toggle-group, tooltip

#### 保留的核心组件
- **基础组件**: button, input, dialog, form, table, card, label, select, tabs, toast, checkbox, textarea, progress, separator

### 🔧 技术优化

#### 依赖管理
- **Workspaces支持**: 使用npm workspaces统一管理前后端依赖
- **精简依赖**: 移除未使用的库和组件
- **版本统一**: 统一TypeScript和构建工具版本

#### 构建优化
- **并行构建**: 前后端可独立构建
- **代码分割**: Vite构建优化，支持vendor、ui、utils分包
- **类型检查**: 强化TypeScript配置，提高代码质量

#### Docker优化
- **多阶段构建**: 分离前后端构建阶段
- **镜像优化**: 使用alpine镜像减少体积
- **健康检查**: 改进容器健康监控

### 📊 性能提升

- **代码体积减少**: 预计减少30%的前端代码体积
- **构建速度**: 前后端独立构建，提升开发效率
- **运行时性能**: 优化的TypeScript配置和代码分割

### 🛠️ 开发体验改进

#### 配置优化
- **ESLint规则**: 强化代码规范检查
- **TypeScript严格模式**: 提高类型安全
- **开发环境**: 支持前后端独立开发调试

#### 工具链
- **统一脚本**: 根目录统一的开发和构建脚本
- **并发支持**: 支持同时启动前后端开发服务器
- **测试集成**: 独立的测试配置和运行环境

### 📚 文档更新

- **README**: 全新的项目介绍和快速开始指南
- **环境变量**: 详细的环境配置说明
- **部署指南**: Docker部署和本地开发指南

### 🔄 迁移路径

从v1.x迁移到v2.0的关键变更：
1. 项目结构完全重组为前后端分离
2. UI组件库精简，移除未使用组件
3. 构建系统重构，支持独立构建
4. Docker配置优化，支持多阶段构建

### ⚡ 下一步计划

- [ ] 迁移核心业务代码（认证、视频、单词本等）
- [ ] 数据库结构优化和清理
- [ ] 测试用例迁移和验证
- [ ] 性能测试和优化
- [ ] 生产部署验证

---

### 技术债务清理

#### 已解决
- ✅ 组件库冗余问题
- ✅ 构建配置混乱
- ✅ 前后端耦合过度
- ✅ Docker构建效率低

#### 计划解决
- [ ] 数据库表结构优化
- [ ] API路由重构
- [ ] 代码质量提升
- [ ] 测试覆盖完善

### 兼容性说明

- **Node.js**: 要求 ≥ 20.0.0
- **数据库**: 兼容现有SQLite数据格式
- **API**: 保持现有API接口兼容性
- **功能**: 保留所有核心功能

---

## 关于版本号

我们采用语义化版本控制：
- **主版本号**: 不兼容的API修改
- **次版本号**: 向下兼容的功能性新增
- **修订版本号**: 向下兼容的问题修正

## 参与贡献

欢迎提交Issue和Pull Request来帮助改进项目！
