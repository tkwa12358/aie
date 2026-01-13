#!/bin/bash

# ============================================
# AI English Studio - Docker 一键部署脚本
# ============================================
# 使用方法:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# 可选参数:
#   --build     强制重新构建镜像
#   --restart   重启服务
#   --stop      停止服务
#   --logs      查看日志
#   --status    查看状态
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="AI English Studio"
CONTAINER_NAME="ai-english-studio"
COMPOSE_FILE="docker-compose.prod.yml"

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 切换到项目目录
cd "$PROJECT_DIR"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    log_info "检查 Docker 环境..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        log_info "安装指南: https://docs.docker.com/engine/install/"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi

    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker"
        exit 1
    fi

    log_success "Docker 环境检查通过"
}

# 生成随机 JWT Secret
generate_jwt_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 48 | tr -d '\n'
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}

# 创建 .env 文件
create_env_file() {
    if [ -f .env ]; then
        log_info ".env 文件已存在，跳过创建"
        return
    fi

    log_info "创建 .env 配置文件..."

    # 生成 JWT Secret
    JWT_SECRET=$(generate_jwt_secret)

    cat > .env << EOF
# ============================================
# AI English Studio - 生产环境配置
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
# ============================================

# JWT 认证配置（已自动生成安全密钥）
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# 服务配置
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# 数据库性能配置
SQLITE_CACHE_SIZE=64000
SQLITE_MMAP_SIZE=268435456

# ============================================
# 以下配置为可选项，按需填写
# ============================================

# 翻译服务配置
# BAIDU_APP_ID=your-baidu-app-id
# BAIDU_API_KEY=your-baidu-api-key
# OPENAI_API_KEY=your-openai-api-key

# 语音评测服务配置
# AZURE_SPEECH_KEY=your-azure-speech-key
# AZURE_SPEECH_REGION=eastasia
# TENCENT_SECRET_ID=your-tencent-secret-id
# TENCENT_SECRET_KEY=your-tencent-secret-key
EOF

    chmod 600 .env
    log_success ".env 文件已创建（JWT_SECRET 已自动生成）"
}

# 创建必要的目录
create_directories() {
    log_info "创建数据目录..."

    mkdir -p backend/database
    mkdir -p backend/uploads/videos
    mkdir -p backend/uploads/thumbnails
    mkdir -p backend/uploads/import
    mkdir -p logs

    # 设置正确的目录权限（容器内 node 用户的 UID 是 1001）
    if [ "$(id -u)" = "0" ]; then
        chown -R 1001:1001 backend/database
        chown -R 1001:1001 backend/uploads
    fi

    log_success "目录结构已创建"
}

# 构建镜像
build_image() {
    log_info "构建 Docker 镜像..."

    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" build --no-cache
    else
        docker-compose -f "$COMPOSE_FILE" build --no-cache
    fi

    log_success "镜像构建完成"
}

# 启动服务
start_service() {
    log_info "启动服务..."

    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" up -d
    else
        docker-compose -f "$COMPOSE_FILE" up -d
    fi

    log_success "服务已启动"
}

# 停止服务
stop_service() {
    log_info "停止服务..."

    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" down
    else
        docker-compose -f "$COMPOSE_FILE" down
    fi

    log_success "服务已停止"
}

# 重启服务
restart_service() {
    log_info "重启服务..."

    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" restart
    else
        docker-compose -f "$COMPOSE_FILE" restart
    fi

    log_success "服务已重启"
}

# 查看日志
show_logs() {
    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" logs -f --tail=100
    else
        docker-compose -f "$COMPOSE_FILE" logs -f --tail=100
    fi
}

# 查看状态
show_status() {
    echo ""
    echo "============================================"
    echo "        $PROJECT_NAME 服务状态"
    echo "============================================"
    echo ""

    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" ps
    else
        docker-compose -f "$COMPOSE_FILE" ps
    fi

    echo ""

    # 检查健康状态
    if docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null | grep -q "healthy"; then
        log_success "服务健康状态: 正常"
    else
        log_warn "服务健康状态: 检查中或异常"
    fi

    echo ""
}

# 等待服务就绪
wait_for_service() {
    log_info "等待服务就绪..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:${PORT:-3000}/health > /dev/null 2>&1; then
            log_success "服务已就绪"
            return 0
        fi

        echo -ne "\r${BLUE}[INFO]${NC} 等待服务启动... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    echo ""
    log_warn "服务启动超时，请检查日志"
    return 1
}

# 显示访问信息
show_access_info() {
    local port=${PORT:-3000}
    local ip=$(hostname -I 2>/dev/null | awk '{print $1}' || ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d'/' -f1 || echo "localhost")

    echo ""
    echo "============================================"
    echo "        🎉 $PROJECT_NAME 部署完成"
    echo "============================================"
    echo ""
    echo "  访问地址:"
    echo "    本地访问: http://localhost:$port"
    echo "    网络访问: http://$ip:$port"
    echo ""
    echo "  默认管理员账号:"
    echo "    用户名: admin@163.com"
    echo "    密码: admin@163.com"
    echo ""
    echo "  ⚠️  请登录后立即修改默认密码！"
    echo ""
    echo "  常用命令:"
    echo "    查看日志: ./scripts/deploy.sh --logs"
    echo "    查看状态: ./scripts/deploy.sh --status"
    echo "    重启服务: ./scripts/deploy.sh --restart"
    echo "    停止服务: ./scripts/deploy.sh --stop"
    echo ""
    echo "============================================"
}

# 完整部署流程
full_deploy() {
    echo ""
    echo "============================================"
    echo "   $PROJECT_NAME - Docker 一键部署"
    echo "============================================"
    echo ""

    check_docker
    create_env_file
    create_directories

    # 检查是否需要强制重新构建
    if [ "$1" == "--build" ] || [ ! "$(docker images -q $CONTAINER_NAME:latest 2>/dev/null)" ]; then
        build_image
    else
        log_info "使用已有镜像，跳过构建（使用 --build 强制重新构建）"
    fi

    start_service
    wait_for_service
    show_access_info
}

# 显示帮助
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  (无参数)    完整部署流程"
    echo "  --build     强制重新构建镜像"
    echo "  --restart   重启服务"
    echo "  --stop      停止服务"
    echo "  --logs      查看服务日志"
    echo "  --status    查看服务状态"
    echo "  --help      显示帮助信息"
    echo ""
}

# 主入口
case "${1:-}" in
    --build)
        check_docker
        build_image
        start_service
        wait_for_service
        show_access_info
        ;;
    --restart)
        check_docker
        restart_service
        ;;
    --stop)
        check_docker
        stop_service
        ;;
    --logs)
        show_logs
        ;;
    --status)
        show_status
        ;;
    --help|-h)
        show_help
        ;;
    *)
        full_deploy "$1"
        ;;
esac
