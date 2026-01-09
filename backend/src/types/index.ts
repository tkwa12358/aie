/**
 * 用户相关类型定义
 */
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  voice_credits: number;
  professional_voice_minutes: number;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInfo {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  voiceCredits: number;
  professionalVoiceMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  email: string;
  phone: string | null;
  password: string;
  displayName?: string;
  role?: 'user' | 'admin';
}

/**
 * 认证相关类型定义
 */
export interface LoginCredentials {
  account: string;
  password: string;
  deviceId?: string;
  deviceInfo?: string;
}

export interface RegisterData {
  account: string;
  password: string;
  code?: string;
  deviceFingerprint?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: UserInfo;
}

export interface TokenPair {
  token: string;
  refreshToken: string;
}

/**
 * 会话相关类型定义
 */
export interface Session {
  id: string;
  user_id: string;
  device_id: string | null;
  device_info: string | null;
  ip_address: string | null;
  token: string;
  expires_at: string;
  last_active_at: string;
  created_at: string;
}

export interface SessionInfo {
  id: string;
  deviceId: string | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
}

/**
 * 视频相关类型定义
 */
export interface VideoCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Video {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  subtitles_en: string | null;
  subtitles_cn: string | null;
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVideoRequest {
  categoryId?: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  subtitlesEn?: string;
  subtitlesCn?: string;
  isPublished?: boolean;
}

/**
 * 学习进度相关类型定义
 */
export interface LearningProgress {
  id: string;
  user_id: string;
  video_id: string;
  last_position: number;
  completed_sentences: string; // JSON字符串
  total_practice_time: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateProgressRequest {
  videoId: string;
  lastPosition: number;
  completedSentences: number[];
  practiceTime: number;
}

/**
 * 单词相关类型定义
 */
export interface WordCache {
  id: string;
  word: string;
  phonetic: string | null;
  translation: string | null;
  definitions: string; // JSON字符串
  created_at: string;
  updated_at: string;
}

export interface WordBook {
  id: string;
  user_id: string;
  word: string;
  phonetic: string | null;
  translation: string | null;
  context: string | null;
  context_translation: string | null;
  definitions: string; // JSON字符串
  mastery_level: number;
  created_at: string;
  reviewed_at: string | null;
}

export interface AddWordRequest {
  word: string;
  phonetic?: string;
  translation?: string;
  context?: string;
  contextTranslation?: string;
  definitions?: any[];
}

/**
 * 评测相关类型定义
 */
export interface ProfessionalAssessmentProvider {
  id: string;
  name: string;
  provider_type: 'azure' | 'tencent' | 'baidu';
  api_endpoint: string;
  api_key_secret_name: string | null;
  api_secret_key_name: string | null;
  region: string | null;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalAssessment {
  id: string;
  user_id: string;
  video_id: string | null;
  original_text: string;
  provider_id: string | null;
  provider_name: string;
  pronunciation_score: number | null;
  accuracy_score: number | null;
  fluency_score: number | null;
  completeness_score: number | null;
  overall_score: number | null;
  words_result: string | null;
  phonemes_result: string | null;
  feedback: string | null;
  duration_seconds: number | null;
  minutes_charged: number;
  is_billed: boolean;
  billing_error: string | null;
  raw_response: string | null;
  created_at: string;
}

export interface AssessmentRequest {
  text: string;
  audioData: string; // Base64编码的音频数据
  videoId?: string;
  providerId?: string;
}

/**
 * 授权码相关类型定义
 */
export interface AuthCode {
  id: string;
  code: string;
  code_type: 'app_unlock' | 'pro_10min' | 'pro_30min' | 'pro_60min' | 'registration';
  minutes_amount: number | null;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface GenerateAuthCodeRequest {
  codeType: AuthCode['code_type'];
  minutesAmount?: number;
  quantity?: number;
  expiresAt?: string;
}

export interface RedeemAuthCodeRequest {
  code: string;
}

/**
 * 统计相关类型定义
 */
export interface UserStatistics {
  id: string;
  user_id: string;
  total_watch_time: number;
  total_practice_time: number;
  today_watch_time: number;
  today_practice_time: number;
  total_videos_watched: number;
  total_sentences_completed: number;
  total_words_learned: number;
  total_assessments: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyStatistics {
  id: string;
  user_id: string;
  study_date: string;
  watch_time: number;
  practice_time: number;
  sentences_completed: number;
  words_learned: number;
  videos_watched: number;
  created_at: string;
}

/**
 * 设备注册相关类型定义
 */
export interface DeviceRegistration {
  id: string;
  device_fingerprint: string;
  user_id: string;
  account: string;
  max_registrations: number;
  created_at: string;
}

/**
 * 翻译服务相关类型定义
 */
export interface TranslationProvider {
  id: string;
  name: string;
  provider_type: 'baidu' | 'openai' | 'google';
  app_id: string | null;
  api_key: string;
  api_secret: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TranslateRequest {
  text: string;
  from?: string;
  to?: string;
  provider?: string;
}

/**
 * API响应类型定义
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 错误类型定义
 */
export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: any;
}

/**
 * 数据库查询结果类型
 */
export interface QueryResult {
  changes: number;
  lastInsertRowid?: number;
}

/**
 * 通用配置类型
 */
export interface AppConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  database: {
    path: string;
    cacheSize: number;
    mmapSize: number;
  };
  upload: {
    maxSize: number;
    allowedTypes: string[];
    directory: string;
  };
  rateLimit: {
    windowMs: number;
    maxAttempts: number;
  };
}

/**
 * 环境变量类型定义
 */
export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  DATA_DIR: string;
  UPLOAD_DIR: string;
  MAX_FILE_SIZE: number;
  BAIDU_APP_ID?: string;
  BAIDU_API_KEY?: string;
  OPENAI_API_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  TENCENT_SECRET_ID?: string;
  TENCENT_SECRET_KEY?: string;
}