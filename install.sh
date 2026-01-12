#!/bin/bash

# ============================================
# AI English Studio - 一键安装脚本
# ============================================
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/tkwa12358/aie/main/install.sh | bash
# 或:
#   wget -qO- https://raw.githubusercontent.com/tkwa12358/aie/main/install.sh | bash
# 或:
#   chmod +x install.sh && ./install.sh
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="AI English Studio"
REPO_URL="https://github.com/tkwa12358/aie.git"
INSTALL_DIR="/opt/ai-english-studio"
CONTAINER_NAME="ai-english-studio"

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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 显示 Banner
show_banner() {
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}     AI English Studio - 一键安装脚本      ${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
}

# 检查是否为 root 用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        log_info "使用: sudo $0"
        exit 1
    fi
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS="centos"
    else
        OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    fi

    log_info "检测到操作系统: $OS ${VERSION:-}"
}

# 安装 Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_success "Docker 已安装: $(docker --version)"
        return 0
    fi

    log_step "安装 Docker..."

    case "$OS" in
        ubuntu|debian)
            # 更新包索引
            apt-get update -qq

            # 安装依赖
            apt-get install -y -qq \
                apt-transport-https \
                ca-certificates \
                curl \
                gnupg \
                lsb-release > /dev/null

            # 添加 Docker 官方 GPG 密钥
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg 2>/dev/null

            # 设置稳定版仓库
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS \
                $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

            # 安装 Docker
            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null
            ;;

        centos|rhel|rocky|almalinux|fedora)
            # 安装 yum-utils
            yum install -y yum-utils > /dev/null 2>&1

            # 添加 Docker 仓库
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo > /dev/null 2>&1

            # 安装 Docker
            yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null 2>&1
            ;;

        *)
            log_warn "未知操作系统，尝试使用官方脚本安装 Docker..."
            curl -fsSL https://get.docker.com | sh
            ;;
    esac

    # 启动 Docker 服务
    systemctl enable docker > /dev/null 2>&1
    systemctl start docker

    log_success "Docker 安装完成: $(docker --version)"
}

# 检查 Docker Compose
check_docker_compose() {
    if docker compose version &> /dev/null; then
        log_success "Docker Compose 已安装: $(docker compose version --short)"
        return 0
    fi

    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose 已安装: $(docker-compose --version)"
        return 0
    fi

    log_error "Docker Compose 未安装"
    exit 1
}

# 克隆或更新项目
clone_project() {
    log_step "获取项目代码..."

    if [ -d "$INSTALL_DIR" ]; then
        if [ -d "$INSTALL_DIR/.git" ]; then
            log_info "项目目录已存在，更新代码..."
            cd "$INSTALL_DIR"
            git fetch origin main > /dev/null 2>&1
            git reset --hard origin/main > /dev/null 2>&1
        else
            log_warn "目录已存在但不是 git 仓库，备份并重新克隆..."
            mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%Y%m%d%H%M%S)"
            git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" > /dev/null 2>&1
        fi
    else
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" > /dev/null 2>&1
    fi

    cd "$INSTALL_DIR"
    log_success "项目代码已就绪"
}

# 生成随机 JWT Secret
generate_jwt_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 48 | tr -d '\n'
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}

# 创建环境配置文件
create_env_file() {
    if [ -f .env ]; then
        log_info ".env 文件已存在，保留现有配置"
        return
    fi

    log_step "创建环境配置..."

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

# 语音评测服务配置
# AZURE_SPEECH_KEY=your-azure-speech-key
# AZURE_SPEECH_REGION=eastasia
EOF

    chmod 600 .env
    log_success "环境配置已生成"
}

# 创建必要的目录
create_directories() {
    log_step "创建数据目录..."

    mkdir -p backend/database
    mkdir -p backend/uploads/videos
    mkdir -p backend/uploads/thumbnails
    mkdir -p logs

    log_success "目录结构已创建"
}

# 构建 Docker 镜像
build_image() {
    log_step "构建 Docker 镜像（这可能需要几分钟）..."

    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.prod.yml build --no-cache
    else
        docker-compose -f docker-compose.prod.yml build --no-cache
    fi

    log_success "镜像构建完成"
}

# 启动服务
start_service() {
    log_step "启动服务..."

    # 先停止旧容器（如果存在）
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "停止旧容器..."
        if docker compose version &> /dev/null; then
            docker compose -f docker-compose.prod.yml down > /dev/null 2>&1 || true
        else
            docker-compose -f docker-compose.prod.yml down > /dev/null 2>&1 || true
        fi
    fi

    # 启动新容器
    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.prod.yml up -d
    else
        docker-compose -f docker-compose.prod.yml up -d
    fi

    log_success "服务已启动"
}

# 等待服务就绪
wait_for_service() {
    log_step "等待服务就绪..."

    local max_attempts=30
    local attempt=1
    local port=${PORT:-3000}

    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:${port}/health" > /dev/null 2>&1; then
            log_success "服务已就绪"
            return 0
        fi

        echo -ne "\r${BLUE}[INFO]${NC} 等待服务启动... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    echo ""
    log_warn "服务启动超时，请检查日志: docker logs $CONTAINER_NAME"
    return 1
}

# 配置防火墙
configure_firewall() {
    local port=${PORT:-3000}

    # 检查是否有 firewalld
    if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
        log_info "配置 firewalld 防火墙..."
        firewall-cmd --permanent --add-port=${port}/tcp > /dev/null 2>&1 || true
        firewall-cmd --reload > /dev/null 2>&1 || true
    fi

    # 检查是否有 ufw
    if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
        log_info "配置 ufw 防火墙..."
        ufw allow ${port}/tcp > /dev/null 2>&1 || true
    fi
}

# 显示安装结果
show_result() {
    local port=${PORT:-3000}
    local ip=$(hostname -I 2>/dev/null | awk '{print $1}' || ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d'/' -f1 || echo "localhost")

    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}     AI English Studio 安装完成!           ${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "  ${CYAN}访问地址:${NC}"
    echo -e "    本地访问: http://localhost:$port"
    echo -e "    网络访问: http://$ip:$port"
    echo ""
    echo -e "  ${CYAN}默认管理员账号:${NC}"
    echo -e "    用户名: admin@163.com"
    echo -e "    密码: admin@163.com"
    echo ""
    echo -e "  ${YELLOW}请登录后立即修改默认密码!${NC}"
    echo ""
    echo -e "  ${CYAN}常用命令:${NC}"
    echo -e "    查看日志: cd $INSTALL_DIR && ./scripts/deploy.sh --logs"
    echo -e "    查看状态: cd $INSTALL_DIR && ./scripts/deploy.sh --status"
    echo -e "    重启服务: cd $INSTALL_DIR && ./scripts/deploy.sh --restart"
    echo -e "    停止服务: cd $INSTALL_DIR && ./scripts/deploy.sh --stop"
    echo -e "    更新升级: cd $INSTALL_DIR && git pull && ./scripts/deploy.sh --build"
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo ""
}

# 卸载
uninstall() {
    log_warn "即将卸载 $PROJECT_NAME..."
    read -p "确定要卸载吗？这将删除所有数据！(y/N) " confirm

    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "取消卸载"
        exit 0
    fi

    cd "$INSTALL_DIR" 2>/dev/null || true

    # 停止并删除容器
    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    else
        docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    fi

    # 删除镜像
    docker rmi ai-english-studio:latest 2>/dev/null || true

    # 删除项目目录
    rm -rf "$INSTALL_DIR"

    log_success "卸载完成"
}

# 显示帮助
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  (无参数)    完整安装流程"
    echo "  --uninstall 卸载 $PROJECT_NAME"
    echo "  --help      显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0              # 完整安装"
    echo "  $0 --uninstall  # 卸载"
    echo ""
}

# 主函数
main() {
    show_banner
    check_root
    detect_os

    # 安装 git（如果需要）
    if ! command -v git &> /dev/null; then
        log_step "安装 git..."
        case "$OS" in
            ubuntu|debian)
                apt-get update -qq && apt-get install -y -qq git > /dev/null
                ;;
            centos|rhel|rocky|almalinux|fedora)
                yum install -y git > /dev/null 2>&1
                ;;
        esac
    fi

    install_docker
    check_docker_compose
    clone_project
    create_env_file
    create_directories
    build_image
    start_service
    configure_firewall
    wait_for_service
    show_result
}

# 入口
case "${1:-}" in
    --uninstall)
        check_root
        uninstall
        ;;
    --help|-h)
        show_help
        ;;
    *)
        main
        ;;
esac
