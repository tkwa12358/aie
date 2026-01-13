# AI English Studio 生产环境部署指南

本文档介绍如何在 Linux 服务器上一键部署 AI English Studio。

## 系统要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+ (或 docker-compose 1.29+)
- **内存**: 最低 2GB，推荐 4GB+
- **磁盘**: 最低 10GB 可用空间
- **端口**: 3000 (可配置)

## 快速部署

### 1. 安装 Docker

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# 退出并重新登录以使用户组生效
```

**CentOS/RHEL:**
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

### 2. 获取项目代码

```bash
# 克隆项目
git clone https://github.com/your-repo/ai-english-studio.git
cd ai-english-studio

# 或者上传项目压缩包后解压
tar -xzf ai-english-studio.tar.gz
cd ai-english-studio
```

### 3. 一键部署

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

脚本会自动：
- 检查 Docker 环境
- 生成安全的 JWT 密钥
- 创建必要的目录结构
- 构建 Docker 镜像
- 启动服务

### 4. 访问应用

部署完成后：
- **本地访问**: http://localhost:3000
- **网络访问**: http://服务器IP:3000

**默认管理员账号**:
- 用户名: `admin@163.com`
- 密码: `admin@163.com`

> ⚠️ **安全提示**: 首次登录后请立即修改默认密码！

---

## 常用命令

```bash
# 查看服务状态
./scripts/deploy.sh --status

# 查看日志
./scripts/deploy.sh --logs

# 重启服务
./scripts/deploy.sh --restart

# 停止服务
./scripts/deploy.sh --stop

# 强制重新构建
./scripts/deploy.sh --build
```

### 手动 Docker 部署命令

> ⚠️ **重要**: 生产环境部署时，请使用 `-f docker-compose.yml` 明确指定配置文件，避免 `docker-compose.override.yml` 开发配置覆盖生产配置。

```bash
# 生产环境部署（推荐）
docker compose -f docker-compose.yml up -d --build

# 查看日志
docker compose -f docker-compose.yml logs -f

# 停止服务
docker compose -f docker-compose.yml down

# 重启服务
docker compose -f docker-compose.yml restart
```

---

## 高级配置

### 环境变量

部署脚本会自动创建 `.env` 文件。如需自定义配置，编辑 `.env`:

```bash
# JWT 认证配置
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=7d

# 服务配置
PORT=3000

# 翻译服务（可选，见下方说明）
BAIDU_APP_ID=your-baidu-app-id
BAIDU_API_KEY=your-baidu-api-key

# 语音评测（可选）
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=eastasia
TENCENT_SECRET_ID=your-tencent-id
TENCENT_SECRET_KEY=your-tencent-key
```

### 单词查询与翻译服务说明

> ⚠️ **重要**: 以下说明帮助您理解单词查询的工作原理和配置需求

#### 使用的 API

系统使用多 API 聚合策略查询单词信息：

| API | 功能 | 是否需要配置 | 免费额度 |
|-----|------|--------------|----------|
| **Free Dictionary API** | 音标、英文释义 | ❌ 无需配置 | 完全免费 |
| **MyMemory Translation** | 中文翻译（备用） | ❌ 无需配置 | 免费 1000 词/天 |
| **百度翻译 API** | 中文翻译（主要） | ⚠️ 可选配置 | 免费 5 万字符/月 |

#### 免费 API 详情

1. **Free Dictionary API** (https://api.dictionaryapi.dev)
   - 提供：音标、词性、英文定义、例句
   - 无需注册，无需 API Key
   - 完全免费，无调用限制

2. **MyMemory Translation API** (https://api.mymemory.translated.net)
   - 提供：中英文翻译
   - 无需注册，无需 API Key
   - 匿名免费：1000 词/天

#### 是否需要配置百度翻译？

| 场景 | 是否需要百度 | 说明 |
|------|-------------|------|
| **个人学习/测试** | ❌ 不需要 | 免费 API 足够使用 |
| **小团队使用** | ⚠️ 建议配置 | 提高翻译准确性 |
| **生产环境** | ✅ 推荐配置 | 更稳定、翻译质量更高 |

**不配置百度翻译时**：系统自动使用 MyMemory 作为翻译源，功能正常但翻译质量可能略差。

**配置百度翻译方法**：
1. 访问 [百度翻译开放平台](https://api.fanyi.baidu.com/)
2. 注册账号，创建应用获取 APP ID 和密钥
3. 在管理后台 → 翻译配置 → 添加百度翻译服务商


### 修改端口

编辑 `.env` 文件:
```bash
PORT=8080
```

然后重启服务:
```bash
./scripts/deploy.sh --restart
```

### Nginx 反向代理 (推荐)

如果需要域名访问和 HTTPS，配置 Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 增大上传文件大小限制（支持大视频文件）
    client_max_body_size 500M;

    # 增大超时时间（支持大文件上传）
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    client_body_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3000;
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

---

## 数据持久化

所有数据保存在 Docker 命名卷中：

| 卷名 | 用途 | 容器路径 |
|------|------|----------|
| ai-english-data | SQLite 数据库 | /app/database |
| ai-english-uploads | 用户上传文件 | /app/uploads |
| ai-english-logs | 应用日志 | /app/logs |

### 备份数据

```bash
# 备份数据库
docker cp ai-english-studio:/app/database ./backup/database

# 备份上传文件
docker cp ai-english-studio:/app/uploads ./backup/uploads
```

### 恢复数据

```bash
# 恢复数据库
docker cp ./backup/database ai-english-studio:/app/database

# 恢复上传文件
docker cp ./backup/uploads ai-english-studio:/app/uploads
```

---

## 故障排除

### 查看容器日志

```bash
docker logs ai-english-studio -f --tail 100
```

### 检查容器状态

```bash
docker inspect ai-english-studio --format='{{.State.Health.Status}}'
```

### 常见问题

**Q: 端口被占用**
```bash
# 查看占用端口的进程
lsof -i :3000
# 修改 .env 中的 PORT 配置
```

**Q: 权限问题**
```bash
# 确保当前用户在 docker 组中
sudo usermod -aG docker $USER
# 然后重新登录
```

**Q: 挂载目录权限问题（容器无法写入数据）**
```bash
# 容器内 node 用户的 UID 是 1001，需要设置正确的目录权限
sudo chown -R 1001:1001 backend/database
sudo chown -R 1001:1001 backend/uploads
```

**Q: 镜像构建失败**
```bash
# 清理 Docker 缓存后重试
docker system prune -f
./scripts/deploy.sh --build
```

---

## 更新升级

```bash
# 拉取最新代码
git pull origin main

# 重新构建并部署
./scripts/deploy.sh --build
```

---

## 开发者信息

- **项目**: AI English Studio
- **版本**: 2.0.0
- **技术栈**: Node.js + Express + React + SQLite
- **容器**: Docker + Alpine Linux
