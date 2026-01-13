# AI English Studio - 生产环境 Docker 镜像
# 包含: Node.js + SQLite + 前端静态文件 + 词库数据

# ============================================
# 阶段1: 前端构建
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装前端依赖（包含 devDependencies 用于构建）
RUN npm install

# 复制前端源码
COPY frontend/ ./

# 构建前端
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ============================================
# 阶段2: 后端构建
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# sql.js 是纯 JavaScript 实现，无需编译依赖

# 复制后端依赖文件
COPY backend/package*.json ./

# 安装后端依赖
RUN npm install

# 复制后端源码
COPY backend/ ./

# 构建后端
RUN npm run build

# ============================================
# 阶段3: 最终运行镜像
# ============================================
FROM node:20-alpine

LABEL maintainer="AI English Studio Team"
LABEL version="2.0.0"
LABEL description="AI English Studio - 智能英语学习平台"

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache \
    wget \
    curl \
    tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# 复制后端构建产物和依赖
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist ./public

# 复制词库数据
COPY backend/data/dictionary/merged ./data/dictionary/merged

# 创建必要的目录结构（与 docker-compose.yml 挂载路径一致）
RUN mkdir -p \
    /app/backend/database \
    /app/backend/uploads/videos \
    /app/backend/uploads/thumbnails \
    /app/backend/uploads/import \
    /app/logs \
    && chown -R nodejs:nodejs /app

# 设置环境变量（路径与 docker-compose.yml 保持一致）
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/backend/database \
    UPLOAD_DIR=/app/backend/uploads \
    DICTIONARY_DIR=/app/data/dictionary/merged \
    FRONTEND_DIR=/app/public \
    LOG_DIR=/app/logs \
    TZ=Asia/Shanghai

# 切换到非 root 用户
USER nodejs

# 注意：不再声明 VOLUME，让 docker-compose 完全控制数据卷挂载
# 这样可以避免匿名卷导致的数据丢失问题

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "dist/app.js"]
