# 部署指南

本文档介绍如何将AI English Studio部署到生产环境。

## 部署方式概览

AI English Studio 支持多种部署方式：

1. **Docker单容器部署** ⭐ **推荐**
2. **传统服务器部署**
3. **云平台部署**

## 🐳 Docker 部署（推荐）

### 前提条件

- Docker 24.0+
- Docker Compose 2.0+
- 至少 2GB 内存
- 至少 5GB 磁盘空间

### 快速部署

#### 1. 准备环境

```bash
# 克隆项目
git clone <repository-url> ai-english-studio
cd ai-english-studio

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置必要配置
```

#### 2. 构建和启动

```bash
# 生产环境部署
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 3. 验证部署

```bash
# 检查健康状态
curl http://localhost:3000/api/health

# 访问应用
open http://localhost:3000
```

### 高级配置

#### 自定义端口

```bash
# 在 .env 文件中设置
PORT=8080

# 或者在启动时指定
PORT=8080 docker-compose up -d
```

#### 数据持久化

```yaml
# docker-compose.yml 中的卷映射
volumes:
  - ./backend/database:/app/backend/database  # 数据库文件
  - ./backend/uploads:/app/backend/uploads    # 用户上传文件
```

#### 性能调优

```bash
# .env 文件中设置
SQLITE_CACHE_SIZE=128000     # 增大缓存到128MB
SQLITE_MMAP_SIZE=536870912   # 增大内存映射到512MB
```

## 🌐 云平台部署

### AWS 部署

#### 使用 AWS ECS

```bash
# 1. 构建镜像推送到 ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-west-2.amazonaws.com

docker build -t ai-english-studio .
docker tag ai-english-studio:latest <account>.dkr.ecr.us-west-2.amazonaws.com/ai-english-studio:latest
docker push <account>.dkr.ecr.us-west-2.amazonaws.com/ai-english-studio:latest

# 2. 创建 ECS 服务
aws ecs create-service --cluster ai-english-cluster --service-name ai-english-service
```

#### 使用 AWS EC2

```bash
# 在 EC2 实例上
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 部署应用
git clone <repository-url>
cd ai-english-studio
docker-compose up -d --build
```

### 阿里云部署

#### 使用容器服务 ACK

```bash
# 1. 推送到阿里云容器镜像服务
sudo docker login --username=<username> registry.cn-hangzhou.aliyuncs.com
docker build -t ai-english-studio .
docker tag ai-english-studio registry.cn-hangzhou.aliyuncs.com/<namespace>/ai-english-studio:latest
docker push registry.cn-hangzhou.aliyuncs.com/<namespace>/ai-english-studio:latest

# 2. 创建 Kubernetes 部署
kubectl apply -f k8s/deployment.yaml
```

#### 使用 ECS 云服务器

```bash
# 在 ECS 实例上
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker

# 部署应用
git clone <repository-url>
cd ai-english-studio
docker-compose up -d --build
```

## 🔧 传统服务器部署

### Ubuntu/Debian

```bash
# 1. 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装项目
git clone <repository-url> ai-english-studio
cd ai-english-studio
npm run install:all

# 3. 构建项目
npm run build

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 5. 启动服务
npm start

# 6. 使用 PM2 管理进程
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### CentOS/RHEL

```bash
# 1. 安装 Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 2. 部署应用
git clone <repository-url> ai-english-studio
cd ai-english-studio
npm run install:all
npm run build

# 3. 启动服务
npm start
```

### PM2 配置

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'ai-english-studio',
    script: './backend/dist/app.js',
    cwd: '/path/to/ai-english-studio',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    log_file: './logs/app.log',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    max_memory_restart: '1G',
  }]
};
```

## 🔒 安全配置

### SSL/HTTPS 配置

#### 使用 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/ai-english-studio
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 使用 Docker + Nginx

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    build: .
    environment:
      NODE_ENV: production
    networks:
      - internal

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    networks:
      - internal

networks:
  internal:
    driver: bridge
```

### 环境变量安全

```bash
# 生产环境必须设置强密码
JWT_SECRET=$(openssl rand -base64 32)

# 限制文件权限
chmod 600 .env
chown app:app .env

# 使用 Docker secrets（推荐）
echo "strong-jwt-secret" | docker secret create jwt_secret -
```

## 📊 监控与日志

### 应用监控

#### Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
```

#### 健康检查

```bash
# 自动健康检查脚本
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
if curl -f $HEALTH_URL > /dev/null 2>&1; then
    echo "✅ Service is healthy"
else
    echo "❌ Service is down, restarting..."
    docker-compose restart app
fi
```

### 日志管理

#### 使用 Docker 日志

```bash
# 查看实时日志
docker-compose logs -f app

# 限制日志大小
# docker-compose.yml 中添加：
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

#### 使用 ELK Stack

```yaml
# docker-compose.elk.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.14.0
    environment:
      - discovery.type=single-node

  logstash:
    image: docker.elastic.co/logstash/logstash:7.14.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: docker.elastic.co/kibana/kibana:7.14.0
    ports:
      - "5601:5601"
```

## 🚀 性能优化

### 数据库优化

```bash
# SQLite 性能配置
SQLITE_CACHE_SIZE=256000      # 256MB 缓存
SQLITE_MMAP_SIZE=1073741824   # 1GB 内存映射
SQLITE_JOURNAL_MODE=WAL       # WAL 模式
```

### 前端优化

```bash
# 启用 gzip 压缩
# nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;

# 设置缓存
location /static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 容器优化

```dockerfile
# 多阶段构建优化
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# 非 root 用户运行
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs
```

## 🔄 备份与恢复

### 数据库备份

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# 备份 SQLite 数据库
cp backend/database/ai_english.db "$BACKUP_DIR/ai_english_$DATE.db"

# 备份上传文件
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" backend/uploads/

echo "✅ Backup completed: $DATE"
```

### 自动备份

```bash
# 添加到 crontab
0 2 * * * /path/to/backup.sh

# Docker 环境自动备份
docker run --rm -v $(pwd):/backup alpine sh -c "cd /backup && ./backup.sh"
```

### 数据恢复

```bash
#!/bin/bash
# restore.sh
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
fi

# 停止服务
docker-compose down

# 恢复数据库
cp "$BACKUP_FILE" backend/database/ai_english.db

# 启动服务
docker-compose up -d

echo "✅ Restore completed"
```

## 📋 部署检查清单

### 部署前检查

- [ ] 环境变量已正确配置
- [ ] JWT_SECRET 已设置为强密码
- [ ] 端口未被占用
- [ ] 数据目录权限正确
- [ ] SSL 证书已配置（生产环境）
- [ ] 防火墙规则已设置

### 部署后验证

- [ ] 应用可正常访问
- [ ] 健康检查接口正常
- [ ] 用户注册登录功能正常
- [ ] 文件上传功能正常
- [ ] 数据库读写正常
- [ ] 日志记录正常

### 性能检查

- [ ] 响应时间 < 500ms
- [ ] 内存使用 < 1GB
- [ ] CPU 使用率 < 80%
- [ ] 磁盘空间充足

## 🆘 故障排除

### 常见问题

#### 1. 容器启动失败

```bash
# 查看详细日志
docker-compose logs app

# 检查端口占用
netstat -tlnp | grep 3000

# 重新构建
docker-compose down
docker-compose up --build -d
```

#### 2. 数据库连接失败

```bash
# 检查数据目录权限
ls -la backend/database/

# 检查环境变量
docker-compose exec app env | grep DATA_DIR

# 重置数据库
rm -f backend/database/*.db
docker-compose restart app
```

#### 3. 静态文件访问失败

```bash
# 检查前端构建
docker-compose exec app ls -la /app/public/

# 重新构建前端
docker-compose down
docker-compose up --build -d
```

### 获取帮助

- **查看日志**: `docker-compose logs -f`
- **进入容器**: `docker-compose exec app sh`
- **健康检查**: `curl http://localhost:3000/api/health`
- **查看进程**: `docker-compose ps`

如果问题持续存在，请提交详细的错误信息和环境配置到项目 Issue。