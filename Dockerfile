# AI English Studio - 前后端分离单容器部署
# 包含: Node.js + SQLite + 前端静态文件 + 词库数据

# 构建阶段 - 使用workspace结构
FROM node:20-alpine AS builder

WORKDIR /app

# 安装编译依赖
RUN apk add --no-cache python3 make g++

# 复制workspace配置
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# 安装所有依赖
RUN npm install

# 复制源码
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# 构建前端
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:frontend

# 构建后端
RUN npm run build:backend

# 最终运行镜像
FROM node:20-alpine

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache wget

# 复制后端构建产物
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./

# 复制前端构建产物
COPY --from=builder /app/frontend/dist ./public

# 创建必要目录
RUN mkdir -p /app/backend/database /app/backend/uploads

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/backend/database
ENV UPLOAD_DIR=/app/backend/uploads
ENV FRONTEND_DIR=/app/public

# 持久化卷
VOLUME ["/app/backend/database", "/app/backend/uploads"]

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "dist/app.js"]