import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// 数据库文件路径
const dataDir = process.env.DATA_DIR || './data';
const dbPath = path.join(dataDir, 'ai_english.db');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 数据库实例
let db: Database | null = null;

// 保存节流控制
let saveTimeout: NodeJS.Timeout | null = null;
let pendingSave = false;

// 初始化数据库
export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // 如果数据库文件存在，加载它
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  console.log(`✅ SQLite database connected: ${dbPath}`);

  if (!db) {
    throw new Error('Failed to initialize database');
  }

  // 启用外键和性能优化
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA synchronous = NORMAL');     // 平衡安全性和性能
  db.run('PRAGMA cache_size = -64000');       // 64MB 缓存
  db.run('PRAGMA temp_store = MEMORY');       // 临时表使用内存
  db.run('PRAGMA mmap_size = 268435456');     // 256MB 内存映射

  // 创建表
  createTables();

  // 创建索引
  createIndexes();

  // 保存数据库
  saveDatabase();

  console.log('✅ SQLite optimizations applied');
}

// 保存数据库到文件（立即保存）
function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// 延迟保存数据库（节流，避免频繁 I/O）
function saveDatabaseThrottled(): void {
  if (!db) return;
  pendingSave = true;

  if (!saveTimeout) {
    saveTimeout = setTimeout(() => {
      if (pendingSave) {
        saveDatabase();
        pendingSave = false;
      }
      saveTimeout = null;
    }, 1000); // 1秒后保存
  }
}

// 强制保存（用于批量操作后）
export function flushDatabase(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingSave || db) {
    saveDatabase();
    pendingSave = false;
  }
}

// 创建索引
function createIndexes(): void {
  if (!db) return;

  // word_cache 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_word_cache_word ON word_cache(word)');

  // word_book 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_word_book_user ON word_book(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_word_book_word ON word_book(word)');

  // learning_progress 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_learning_progress_user ON learning_progress(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_learning_progress_video ON learning_progress(video_id)');

  // videos 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published)');

  // user_sessions 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)');

  // auth_codes 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_auth_codes_code ON auth_codes(code)');
  db.run('CREATE INDEX IF NOT EXISTS idx_auth_codes_used ON auth_codes(is_used)');
}

// 创建所有表
function createTables(): void {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      voice_credits INTEGER DEFAULT 0,
      professional_voice_minutes INTEGER DEFAULT 0,
      email_confirmed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT,
      device_info TEXT,
      ip_address TEXT,
      token TEXT UNIQUE,
      expires_at TEXT,
      last_active_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS video_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
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
      is_published INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS learning_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      video_id TEXT,
      last_position INTEGER DEFAULT 0,
      completed_sentences TEXT DEFAULT '[]',
      total_practice_time INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS word_book (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      word TEXT NOT NULL,
      phonetic TEXT,
      translation TEXT,
      context TEXT,
      context_translation TEXT,
      definitions TEXT DEFAULT '[]',
      mastery_level INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS word_cache (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL UNIQUE,
      phonetic TEXT,
      translation TEXT,
      definitions TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS auth_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      code_type TEXT NOT NULL,
      minutes_amount INTEGER,
      is_used INTEGER DEFAULT 0,
      used_by TEXT,
      used_at TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS voice_assessments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      video_id TEXT,
      original_text TEXT NOT NULL,
      user_audio_url TEXT,
      accuracy_score REAL,
      fluency_score REAL,
      completeness_score REAL,
      overall_score REAL,
      feedback TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS professional_assessment_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      api_endpoint TEXT NOT NULL,
      api_key_secret_name TEXT,
      api_secret_key_name TEXT,
      region TEXT,
      is_active INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      config_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS professional_assessments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      video_id TEXT,
      original_text TEXT NOT NULL,
      provider_id TEXT,
      provider_name TEXT NOT NULL,
      pronunciation_score REAL,
      accuracy_score REAL,
      fluency_score REAL,
      completeness_score REAL,
      overall_score REAL,
      words_result TEXT,
      phonemes_result TEXT,
      feedback TEXT,
      duration_seconds INTEGER,
      minutes_charged INTEGER DEFAULT 0,
      is_billed INTEGER DEFAULT 0,
      billing_error TEXT,
      raw_response TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS translation_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      app_id TEXT,
      api_key TEXT NOT NULL,
      api_secret TEXT,
      is_active INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
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
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_statistics (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      study_date TEXT NOT NULL,
      watch_time INTEGER DEFAULT 0,
      practice_time INTEGER DEFAULT 0,
      sentences_completed INTEGER DEFAULT 0,
      words_learned INTEGER DEFAULT 0,
      videos_watched INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 设备注册记录表（用于防刷注册）
  db.run(`
    CREATE TABLE IF NOT EXISTS device_registrations (
      id TEXT PRIMARY KEY,
      device_fingerprint TEXT NOT NULL,
      user_id TEXT NOT NULL,
      account TEXT NOT NULL,
      max_registrations INTEGER DEFAULT 3,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建设备指纹索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_fp ON device_registrations(device_fingerprint)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_user ON device_registrations(user_id)`);

  // 插入默认视频分类
  const existingCats = query('SELECT COUNT(*) as count FROM video_categories');
  if (existingCats.length === 0 || (existingCats[0] as any).count === 0) {
    run('INSERT OR IGNORE INTO video_categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)', ['cat-1', '日常对话', '日常生活中的英语对话', 1]);
    run('INSERT OR IGNORE INTO video_categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)', ['cat-2', '商务英语', '商务场景的英语表达', 2]);
    run('INSERT OR IGNORE INTO video_categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)', ['cat-3', '新闻英语', '新闻报道和时事话题', 3]);
    run('INSERT OR IGNORE INTO video_categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)', ['cat-4', '影视英语', '电影和电视剧片段', 4]);
    run('INSERT OR IGNORE INTO video_categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)', ['cat-5', '演讲TED', 'TED演讲和公开演讲', 5]);
  }

  // 插入默认管理员
  const existingAdmin = queryOne("SELECT id FROM users WHERE email = 'admin@163.com'");
  if (!existingAdmin) {
    console.log('Creating default admin user...');
    const adminId = 'admin-default-id';
    // Password: admin@163.com
    const passwordHash = '$2b$10$RycdQ6rfVjcuacIamWrdUuYfuiUmQ0u1bS5O/5z18X6tFiP1G/LiK';

    run(`INSERT INTO users (id, email, password_hash, display_name, role, email_confirmed_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [adminId, 'admin@163.com', passwordHash, 'Admin', 'admin']);

    // 初始化统计表
    run(`INSERT INTO user_statistics (id, user_id) VALUES (?, ?)`, ['admin-stats-id', adminId]);
  }

  saveDatabase();
  console.log('✅ Database tables initialized');
}

// 测试数据库连接
export function testConnection(): boolean {
  try {
    if (!db) return false;
    db.exec('SELECT 1');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// 查询辅助函数
export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const results = query<T>(sql, params);
  return results[0];
}

export function run(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDatabaseThrottled();
}

export function insert(sql: string, params: any[] = []): void {
  run(sql, params);
}

export function update(sql: string, params: any[] = []): number {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  const changes = db.getRowsModified();
  saveDatabaseThrottled();
  return changes;
}

/**
 * 批量执行 SQL 操作（使用事务）
 * 适用于大量数据导入，避免频繁磁盘 I/O
 */
export function runBatch(operations: Array<{ sql: string; params: any[] }>): number {
  if (!db) throw new Error('Database not initialized');

  let executed = 0;

  db.run('BEGIN TRANSACTION');
  try {
    for (const op of operations) {
      db.run(op.sql, op.params);
      executed++;
    }
    db.run('COMMIT');

    // 批量操作后立即保存
    saveDatabase();

    return executed;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

/**
 * 批量 UPSERT 单词到缓存（优化的词库导入）
 */
export function batchUpsertWords(words: Array<{
  id: string;
  word: string;
  phonetic?: string | null;
  translation?: string | null;
  definitions?: any[];
}>): number {
  if (!db) throw new Error('Database not initialized');

  let count = 0;

  db.run('BEGIN TRANSACTION');
  try {
    for (const w of words) {
      db.run(
        `INSERT INTO word_cache (id, word, phonetic, translation, definitions)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(word) DO UPDATE SET
           phonetic = COALESCE(excluded.phonetic, word_cache.phonetic),
           translation = COALESCE(excluded.translation, word_cache.translation),
           definitions = COALESCE(excluded.definitions, word_cache.definitions),
           updated_at = datetime('now')`,
        [w.id, w.word.toLowerCase(), w.phonetic || null, w.translation || null, JSON.stringify(w.definitions || [])]
      );
      count++;
    }
    db.run('COMMIT');

    // 批量操作后立即保存
    saveDatabase();

    return count;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

export { db };
export default db;

