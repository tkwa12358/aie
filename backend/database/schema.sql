-- AI English Studio Database Schema
-- Version: 2.0.0
-- Database: SQLite
-- 创建时间: 2026-01-09

-- ============================================================================
-- 性能优化配置
-- ============================================================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 设置日志模式为WAL（写前日志）以提高并发性能
PRAGMA journal_mode = WAL;

-- 设置同步模式为NORMAL以平衡安全性和性能
PRAGMA synchronous = NORMAL;

-- 设置缓存大小（64MB）
PRAGMA cache_size = -64000;

-- 临时表使用内存
PRAGMA temp_store = MEMORY;

-- 内存映射大小（256MB）
PRAGMA mmap_size = 268435456;

-- ============================================================================
-- 用户系统相关表
-- ============================================================================

-- 用户基础信息表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    voice_credits INTEGER DEFAULT 0,
    professional_voice_minutes INTEGER DEFAULT 0,
    email_confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 用户会话管理表
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT,
    device_info TEXT,
    ip_address TEXT,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    last_active_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 设备注册防刷表
CREATE TABLE IF NOT EXISTS device_registrations (
    id TEXT PRIMARY KEY,
    device_fingerprint TEXT NOT NULL,
    user_id TEXT NOT NULL,
    account TEXT NOT NULL,
    max_registrations INTEGER DEFAULT 3,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 视频和学习相关表
-- ============================================================================

-- 视频分类表
CREATE TABLE IF NOT EXISTS video_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 视频信息表
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    category_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER,
    subtitles_en TEXT,
    subtitles_cn TEXT,
    is_published INTEGER DEFAULT 0 CHECK (is_published IN (0, 1)),
    view_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES video_categories(id) ON DELETE SET NULL
);

-- 学习进度表
CREATE TABLE IF NOT EXISTS learning_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    last_position INTEGER DEFAULT 0,
    completed_sentences TEXT DEFAULT '[]',
    total_practice_time INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    UNIQUE(user_id, video_id)
);

-- ============================================================================
-- 单词系统相关表
-- ============================================================================

-- 全局单词缓存表
CREATE TABLE IF NOT EXISTS word_cache (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    phonetic TEXT,
    translation TEXT,
    definitions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 用户单词本表
CREATE TABLE IF NOT EXISTS word_book (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    word TEXT NOT NULL,
    phonetic TEXT,
    translation TEXT,
    context TEXT,
    context_translation TEXT,
    definitions TEXT DEFAULT '[]',
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, word)
);

-- ============================================================================
-- 评测系统相关表
-- 注意：已删除未使用的 voice_assessments 表
-- ============================================================================

-- 专业评测服务提供商表
CREATE TABLE IF NOT EXISTS professional_assessment_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('azure', 'tencent', 'baidu')),
    api_endpoint TEXT NOT NULL,
    api_key_secret_name TEXT,
    api_secret_key_name TEXT,
    region TEXT,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_default INTEGER DEFAULT 0 CHECK (is_default IN (0, 1)),
    priority INTEGER DEFAULT 0,
    config_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 专业评测记录表
CREATE TABLE IF NOT EXISTS professional_assessments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    video_id TEXT,
    original_text TEXT NOT NULL,
    provider_id TEXT,
    provider_name TEXT NOT NULL,
    pronunciation_score REAL CHECK (pronunciation_score BETWEEN 0 AND 100),
    accuracy_score REAL CHECK (accuracy_score BETWEEN 0 AND 100),
    fluency_score REAL CHECK (fluency_score BETWEEN 0 AND 100),
    completeness_score REAL CHECK (completeness_score BETWEEN 0 AND 100),
    overall_score REAL CHECK (overall_score BETWEEN 0 AND 100),
    words_result TEXT,
    phonemes_result TEXT,
    feedback TEXT,
    duration_seconds INTEGER,
    minutes_charged INTEGER DEFAULT 0,
    is_billed INTEGER DEFAULT 0 CHECK (is_billed IN (0, 1)),
    billing_error TEXT,
    raw_response TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
    FOREIGN KEY (provider_id) REFERENCES professional_assessment_providers(id) ON DELETE SET NULL
);

-- ============================================================================
-- 授权和配置相关表
-- ============================================================================

-- 授权码表
CREATE TABLE IF NOT EXISTS auth_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    code_type TEXT NOT NULL CHECK (code_type IN ('app_unlock', 'pro_10min', 'pro_30min', 'pro_60min', 'registration')),
    minutes_amount INTEGER,
    is_used INTEGER DEFAULT 0 CHECK (is_used IN (0, 1)),
    used_by TEXT,
    used_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 翻译服务提供商表
CREATE TABLE IF NOT EXISTS translation_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('baidu', 'openai', 'google')),
    app_id TEXT,
    api_key TEXT NOT NULL,
    api_secret TEXT,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_default INTEGER DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- 统计系统相关表
-- ============================================================================

-- 用户总体统计表
CREATE TABLE IF NOT EXISTS user_statistics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    total_watch_time INTEGER DEFAULT 0,
    total_practice_time INTEGER DEFAULT 0,
    today_watch_time INTEGER DEFAULT 0,
    today_practice_time INTEGER DEFAULT 0,
    total_videos_watched INTEGER DEFAULT 0,
    total_sentences_completed INTEGER DEFAULT 0,
    total_words_learned INTEGER DEFAULT 0,
    total_assessments INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_study_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 每日统计表（保留但优化使用）
CREATE TABLE IF NOT EXISTS daily_statistics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    study_date TEXT NOT NULL,
    watch_time INTEGER DEFAULT 0,
    practice_time INTEGER DEFAULT 0,
    sentences_completed INTEGER DEFAULT 0,
    words_learned INTEGER DEFAULT 0,
    videos_watched INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, study_date)
);

-- ============================================================================
-- 数据库索引
-- ============================================================================

-- 用户相关索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 会话相关索引
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- 设备注册索引
CREATE INDEX IF NOT EXISTS idx_device_fp ON device_registrations(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_user ON device_registrations(user_id);

-- 视频相关索引
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at);

-- 学习进度索引
CREATE INDEX IF NOT EXISTS idx_learning_progress_user ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_video ON learning_progress(video_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_updated ON learning_progress(updated_at);

-- 单词相关索引
CREATE INDEX IF NOT EXISTS idx_word_cache_word ON word_cache(word);
CREATE INDEX IF NOT EXISTS idx_word_book_user ON word_book(user_id);
CREATE INDEX IF NOT EXISTS idx_word_book_word ON word_book(word);
CREATE INDEX IF NOT EXISTS idx_word_book_mastery ON word_book(mastery_level);

-- 评测相关索引
CREATE INDEX IF NOT EXISTS idx_professional_assessments_user ON professional_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_assessments_video ON professional_assessments(video_id);
CREATE INDEX IF NOT EXISTS idx_professional_assessments_created ON professional_assessments(created_at);

-- 授权码索引
CREATE INDEX IF NOT EXISTS idx_auth_codes_code ON auth_codes(code);
CREATE INDEX IF NOT EXISTS idx_auth_codes_used ON auth_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_auth_codes_type ON auth_codes(code_type);

-- 统计相关索引
CREATE INDEX IF NOT EXISTS idx_user_statistics_user ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_statistics_user_date ON daily_statistics(user_id, study_date);
CREATE INDEX IF NOT EXISTS idx_daily_statistics_date ON daily_statistics(study_date);

-- ============================================================================
-- 初始数据插入
-- ============================================================================

-- 插入默认视频分类
INSERT OR IGNORE INTO video_categories (id, name, description, sort_order) VALUES
('cat-1', '日常对话', '日常生活中的英语对话', 1),
('cat-2', '商务英语', '商务场景的英语表达', 2),
('cat-3', '新闻英语', '新闻报道和时事话题', 3),
('cat-4', '影视英语', '电影和电视剧片段', 4),
('cat-5', '演讲TED', 'TED演讲和公开演讲', 5);

-- 插入默认管理员用户
-- 邮箱: admin@163.com
-- 密码: admin@163.com (bcrypt hash)
INSERT OR IGNORE INTO users (
    id,
    email,
    password_hash,
    display_name,
    role,
    email_confirmed_at
) VALUES (
    'admin-default-id',
    'admin@163.com',
    '$2b$10$RycdQ6rfVjcuacIamWrdUuYfuiUmQ0u1bS5O/5z18X6tFiP1G/LiK',
    'System Admin',
    'admin',
    datetime('now')
);

-- 初始化管理员统计数据
INSERT OR IGNORE INTO user_statistics (id, user_id) VALUES
('admin-stats-id', 'admin-default-id');

-- ============================================================================
-- 数据库版本信息
-- ============================================================================

-- 创建版本信息表（用于迁移管理）
CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY,
    version TEXT NOT NULL,
    description TEXT,
    applied_at TEXT DEFAULT (datetime('now'))
);

-- 插入当前版本信息
INSERT OR REPLACE INTO schema_version (id, version, description) VALUES
(1, '2.0.0', 'AI English Studio v2.0 - 优化数据库结构，删除未使用表');

-- ============================================================================
-- 优化和清理命令
-- ============================================================================

-- 执行数据库优化
PRAGMA optimize;

-- 分析统计信息
ANALYZE;

-- ============================================================================
-- 表结构总览（注释）
-- ============================================================================

/*
数据库表总览：

核心业务表 (14张)：
- users                              用户基础信息
- user_sessions                      用户会话管理
- device_registrations               设备注册防刷
- video_categories                   视频分类
- videos                             视频内容
- learning_progress                  学习进度
- word_cache                         全局单词缓存
- word_book                          用户单词本
- professional_assessment_providers  专业评测服务商
- professional_assessments           专业评测记录
- auth_codes                         授权码
- translation_providers              翻译服务商
- user_statistics                    用户统计
- daily_statistics                   每日统计

已删除表：
- voice_assessments                  (完全未使用，已被 professional_assessments 替代)

性能优化：
- 36个索引用于查询优化
- WAL模式提高并发性能
- 64MB内存缓存
- 256MB内存映射
- 外键约束保证数据完整性
- CHECK约束保证数据有效性

版本管理：
- schema_version表记录数据库版本
- 支持未来的数据库迁移
*/