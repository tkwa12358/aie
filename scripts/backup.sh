#!/bin/bash

# AI English Studio 数据库备份脚本
# 用于定期备份数据库和关键数据

set -e  # 遇到错误立即退出

# 配置参数
SOURCE_DIR="${SOURCE_DIR:-/Volumes/aikaifa/claudekaifa/ai-english-studio}"
TARGET_DIR="${TARGET_DIR:-/Volumes/aikaifa/claudekaifa/aie}"
BACKUP_DIR="${BACKUP_DIR:-$TARGET_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 创建备份目录
create_backup_dir() {
    log_info "创建备份目录..."
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/uploads"
    mkdir -p "$BACKUP_DIR/configs"
    log_success "备份目录创建完成: $BACKUP_DIR"
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."

    local source_db="$SOURCE_DIR/backend/data/ai_english.db"
    local backup_db="$BACKUP_DIR/database/ai_english_$TIMESTAMP.db"

    if [ -f "$source_db" ]; then
        cp "$source_db" "$backup_db"
        local size=$(du -h "$backup_db" | cut -f1)
        log_success "数据库备份完成: $backup_db ($size)"

        # 压缩备份
        if command -v gzip >/dev/null 2>&1; then
            gzip "$backup_db"
            local compressed_size=$(du -h "$backup_db.gz" | cut -f1)
            log_success "数据库压缩完成: $backup_db.gz ($compressed_size)"
        fi
    else
        log_warning "源数据库文件不存在: $source_db"
    fi
}

# 备份上传文件
backup_uploads() {
    log_info "备份上传文件..."

    local source_uploads="$SOURCE_DIR/uploads"
    local backup_uploads="$BACKUP_DIR/uploads/uploads_$TIMESTAMP.tar.gz"

    if [ -d "$source_uploads" ] && [ "$(ls -A $source_uploads)" ]; then
        tar -czf "$backup_uploads" -C "$source_uploads" .
        local size=$(du -h "$backup_uploads" | cut -f1)
        log_success "上传文件备份完成: $backup_uploads ($size)"
    else
        log_warning "上传文件目录为空或不存在: $source_uploads"
    fi
}

# 备份配置文件
backup_configs() {
    log_info "备份配置文件..."

    local config_backup="$BACKUP_DIR/configs/configs_$TIMESTAMP.tar.gz"
    local temp_dir=$(mktemp -d)

    # 收集配置文件
    [ -f "$SOURCE_DIR/.env" ] && cp "$SOURCE_DIR/.env" "$temp_dir/"
    [ -f "$SOURCE_DIR/docker-compose.yml" ] && cp "$SOURCE_DIR/docker-compose.yml" "$temp_dir/"
    [ -f "$SOURCE_DIR/package.json" ] && cp "$SOURCE_DIR/package.json" "$temp_dir/"
    [ -f "$SOURCE_DIR/backend/package.json" ] && cp "$SOURCE_DIR/backend/package.json" "$temp_dir/backend-package.json"

    if [ "$(ls -A $temp_dir)" ]; then
        tar -czf "$config_backup" -C "$temp_dir" .
        local size=$(du -h "$config_backup" | cut -f1)
        log_success "配置文件备份完成: $config_backup ($size)"
    else
        log_warning "没有找到配置文件进行备份"
    fi

    rm -rf "$temp_dir"
}

# 备份词典数据
backup_dictionaries() {
    log_info "备份词典数据..."

    local source_dict="$SOURCE_DIR/data/dictionary"
    local backup_dict="$BACKUP_DIR/dictionaries_$TIMESTAMP.tar.gz"

    if [ -d "$source_dict" ] && [ "$(ls -A $source_dict)" ]; then
        tar -czf "$backup_dict" -C "$source_dict" .
        local size=$(du -h "$backup_dict" | cut -f1)
        log_success "词典数据备份完成: $backup_dict ($size)"
    else
        log_warning "词典目录为空或不存在: $source_dict"
    fi
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份文件..."

    local keep_days=${BACKUP_KEEP_DAYS:-7}

    # 清理超过指定天数的备份文件
    find "$BACKUP_DIR" -name "*.gz" -mtime +$keep_days -type f -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.db" -mtime +$keep_days -type f -delete 2>/dev/null || true

    log_success "清理完成，保留最近 $keep_days 天的备份"
}

# 生成备份报告
generate_report() {
    log_info "生成备份报告..."

    local report_file="$BACKUP_DIR/backup_report_$TIMESTAMP.txt"

    cat > "$report_file" << EOF
AI English Studio 备份报告
======================

备份时间: $(date)
备份目录: $BACKUP_DIR

备份文件列表:
$(find "$BACKUP_DIR" -name "*_$TIMESTAMP*" -type f | while read file; do
    size=$(du -h "$file" | cut -f1)
    echo "  - $(basename "$file") ($size)"
done)

总备份大小: $(du -sh "$BACKUP_DIR" | cut -f1)

备份完成时间: $(date)
EOF

    log_success "备份报告生成: $report_file"
}

# 验证备份完整性
verify_backup() {
    log_info "验证备份完整性..."

    local errors=0

    # 检查数据库备份
    local db_backup=$(find "$BACKUP_DIR/database" -name "*_$TIMESTAMP*" -type f | head -1)
    if [ -n "$db_backup" ]; then
        if file "$db_backup" | grep -q "gzip"; then
            if gzip -t "$db_backup" 2>/dev/null; then
                log_success "数据库备份文件完整"
            else
                log_error "数据库备份文件损坏"
                ((errors++))
            fi
        elif file "$db_backup" | grep -q "SQLite"; then
            log_success "数据库备份文件完整"
        else
            log_warning "无法验证数据库备份文件类型"
        fi
    fi

    # 检查压缩文件
    for file in $(find "$BACKUP_DIR" -name "*_$TIMESTAMP*.tar.gz" -type f); do
        if tar -tzf "$file" >/dev/null 2>&1; then
            log_success "压缩文件完整: $(basename "$file")"
        else
            log_error "压缩文件损坏: $(basename "$file")"
            ((errors++))
        fi
    done

    if [ $errors -eq 0 ]; then
        log_success "所有备份文件验证通过"
    else
        log_error "发现 $errors 个备份文件损坏"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
AI English Studio 数据备份脚本

用法: $0 [选项]

选项:
  -h, --help              显示帮助信息
  -d, --database          仅备份数据库
  -u, --uploads           仅备份上传文件
  -c, --configs           仅备份配置文件
  -v, --verify            验证备份文件完整性
  --cleanup              仅清理旧备份
  --no-cleanup           跳过清理旧备份

环境变量:
  SOURCE_DIR            源目录路径（默认: /Volumes/aikaifa/claudekaifa/ai-english-studio）
  TARGET_DIR            目标目录路径（默认: /Volumes/aikaifa/claudekaifa/aie）
  BACKUP_DIR            备份目录路径（默认: \$TARGET_DIR/backups）
  BACKUP_KEEP_DAYS      备份保留天数（默认: 7）

示例:
  $0                    # 完整备份
  $0 --database         # 仅备份数据库
  $0 --verify           # 验证最近的备份
  $0 --cleanup          # 清理旧备份

EOF
}

# 主函数
main() {
    local backup_database=false
    local backup_uploads=false
    local backup_configs=false
    local backup_dictionaries=false
    local verify_only=false
    local cleanup_only=false
    local skip_cleanup=false
    local full_backup=true

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--database)
                backup_database=true
                full_backup=false
                ;;
            -u|--uploads)
                backup_uploads=true
                full_backup=false
                ;;
            -c|--configs)
                backup_configs=true
                full_backup=false
                ;;
            --dictionaries)
                backup_dictionaries=true
                full_backup=false
                ;;
            -v|--verify)
                verify_only=true
                ;;
            --cleanup)
                cleanup_only=true
                ;;
            --no-cleanup)
                skip_cleanup=true
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
        shift
    done

    # 显示开始信息
    echo "================================"
    echo "🚀 AI English Studio 数据备份"
    echo "================================"
    log_info "备份时间: $(date)"
    log_info "源目录: $SOURCE_DIR"
    log_info "备份目录: $BACKUP_DIR"
    echo "--------------------------------"

    # 执行操作
    if [ "$verify_only" = true ]; then
        verify_backup
    elif [ "$cleanup_only" = true ]; then
        cleanup_old_backups
    else
        create_backup_dir

        if [ "$full_backup" = true ]; then
            backup_database
            backup_uploads
            backup_configs
            backup_dictionaries
        else
            [ "$backup_database" = true ] && backup_database
            [ "$backup_uploads" = true ] && backup_uploads
            [ "$backup_configs" = true ] && backup_configs
            [ "$backup_dictionaries" = true ] && backup_dictionaries
        fi

        verify_backup
        generate_report

        if [ "$skip_cleanup" != true ]; then
            cleanup_old_backups
        fi
    fi

    echo "--------------------------------"
    log_success "备份操作完成！"
    echo "================================"
}

# 错误处理
trap 'log_error "备份过程中发生错误"; exit 1' ERR

# 执行主函数
main "$@"