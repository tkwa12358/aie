import api, { getActiveApiUrl } from './api';

// ============ 类型定义 ============

export interface User {
    id: string;
    email: string | null;
    phone: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    role: 'user' | 'admin';
    voiceCredits: number;
    professionalVoiceMinutes: number;
    createdAt?: string;
    updatedAt?: string;
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
    category_name?: string;
}

export interface VideoCategory {
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    created_at: string;
}

export interface LearningProgress {
    id?: string;
    user_id?: string;
    video_id: string;
    last_position: number;
    completed_sentences: number[];
    total_practice_time: number;
    video_title?: string;
}

export interface WordBookEntry {
    id: string;
    user_id: string;
    word: string;
    phonetic: string | null;
    translation: string | null;
    context: string | null;
    context_translation: string | null;
    definitions: any[];
    mastery_level: number;
    created_at: string;
    reviewed_at: string | null;
}

export interface AuthCode {
    id: string;
    code: string;
    code_type: string;
    minutes_amount: number | null;
    is_used: boolean;
    used_by: string | null;
    used_at: string | null;
    expires_at: string | null;
    created_at: string;
}

export interface Subtitle {
    id: number;
    start: number;
    end: number;
    text: string;
    translation?: string;
}

export interface UserStatistics {
    totalWatchTime: number;
    totalPracticeTime: number;
    todayWatchTime: number;
    todayPracticeTime: number;
    totalVideosWatched: number;
    totalSentencesCompleted: number;
    totalWordsLearned: number;
    totalAssessments: number;
    currentStreak: number;
    longestStreak: number;
    lastStudyDate?: string;
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
}

export interface AssessmentProvider {
    id: string;
    name: string;
    provider_type: string;
    region: string | null;
    is_active: boolean;
    is_default: boolean;
    priority: number;
}

export interface TranslationProvider {
    id: string;
    name: string;
    provider_type: string;
    app_id: string | null;
    is_active: boolean;
    is_default: boolean;
}

// ============ 认证 API ============

export const authApi = {
    async register(account: string, password: string, code?: string, deviceFingerprint?: string) {
        const { data } = await api.post('/auth/register', { account, password, code, deviceFingerprint });
        if (data.token) {
            localStorage.setItem('token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
            }
        }
        return data;
    },

    async login(account: string, password: string, deviceId?: string) {
        const { data } = await api.post('/auth/login', { account, password, deviceId });
        if (data.token) {
            localStorage.setItem('token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
            }
        }
        return data;
    },

    async logout(deviceId?: string) {
        try {
            await api.post('/auth/logout', { deviceId });
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
        }
    },

    async getMe(): Promise<User> {
        const { data } = await api.get('/auth/me');
        return data;
    },

    async refresh() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await api.post('/auth/refresh', { refreshToken });
        if (data.token) {
            localStorage.setItem('token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
            }
        }
        return data;
    },

    async checkDevice(deviceId: string, maxDevices = 2) {
        const { data } = await api.post('/auth/check-device', { deviceId, maxDevices });
        return data;
    },

    isLoggedIn(): boolean {
        return !!localStorage.getItem('token');
    }
};

// ============ 用户 API ============

export const usersApi = {
    async getUsers(page = 1, limit = 20) {
        const { data } = await api.get('/users', { params: { page, limit } });
        return data;
    },

    async getUser(id: string): Promise<User> {
        const { data } = await api.get(`/users/${id}`);
        return data;
    },

    async updateUser(id: string, updates: Partial<User>) {
        const { data } = await api.put(`/users/${id}`, updates);
        return data;
    },

    async deleteUser(id: string) {
        const { data } = await api.delete(`/users/${id}`);
        return data;
    },

    async resetPassword(id: string, newPassword: string) {
        const { data } = await api.post(`/users/${id}/reset-password`, { newPassword });
        return data;
    }
};

// ============ 视频 API ============

export const videosApi = {
    async getVideos(params?: { categoryId?: string; published?: boolean; limit?: number; offset?: number }): Promise<Video[]> {
        const { data } = await api.get('/videos', { params });
        return data;
    },

    async getVideo(id: string): Promise<Video> {
        const { data } = await api.get(`/videos/${id}`);
        return data;
    },

    async createVideo(video: Partial<Video>) {
        const { data } = await api.post('/videos', video);
        return data;
    },

    async updateVideo(id: string, updates: Partial<Video>) {
        const { data } = await api.put(`/videos/${id}`, updates);
        return data;
    },

    async deleteVideo(id: string) {
        const { data } = await api.delete(`/videos/${id}`);
        return data;
    },

    async uploadVideo(file: File, videoId?: string) {
        const formData = new FormData();
        formData.append('file', file);
        const url = videoId ? `/videos/${videoId}/upload` : '/videos/upload';
        const { data } = await api.post(url, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return data;
    },

    async uploadThumbnail(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/videos/upload-thumbnail', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return data;
    }
};

// ============ 分类 API ============

export const categoriesApi = {
    async getCategories(): Promise<VideoCategory[]> {
        const { data } = await api.get('/categories');
        return data;
    },

    async getCategory(id: string): Promise<VideoCategory> {
        const { data } = await api.get(`/categories/${id}`);
        return data;
    },

    async createCategory(category: Partial<VideoCategory>) {
        const { data } = await api.post('/categories', category);
        return data;
    },

    async updateCategory(id: string, updates: Partial<VideoCategory>) {
        const { data } = await api.put(`/categories/${id}`, updates);
        return data;
    },

    async deleteCategory(id: string) {
        const { data } = await api.delete(`/categories/${id}`);
        return data;
    }
};

// ============ 学习进度 API ============

export const learningApi = {
    async getProgress(videoId?: string): Promise<LearningProgress | LearningProgress[]> {
        const { data } = await api.get('/learning/progress', { params: { videoId } });
        return data;
    },

    async updateProgress(progress: Partial<LearningProgress>) {
        const { data } = await api.post('/learning/progress', progress);
        return data;
    },

    async getStatistics(): Promise<UserStatistics> {
        const { data } = await api.get('/learning/statistics');
        return data;
    },

    async updateStatistics(updates: Partial<UserStatistics>) {
        const { data } = await api.post('/learning/statistics', updates);
        return data;
    },

    async getDailyStatistics(params?: { startDate?: string; endDate?: string; limit?: number }): Promise<DailyStatistics[]> {
        const { data } = await api.get('/learning/daily', { params });
        return data;
    },

    async getRecentVideos(limit = 5) {
        const { data } = await api.get('/learning/recent', { params: { limit } });
        return data;
    }
};

// ============ 单词本 API ============

export const wordsApi = {
    async getWords(params?: { masteryLevel?: number; limit?: number; offset?: number }): Promise<WordBookEntry[]> {
        const { data } = await api.get('/words', { params });
        return data;
    },

    async addWord(word: Partial<WordBookEntry>) {
        const { data } = await api.post('/words', word);
        return data;
    },

    async updateWord(id: string, updates: Partial<WordBookEntry>) {
        const { data } = await api.put(`/words/${id}`, updates);
        return data;
    },

    async deleteWord(id: string) {
        const { data } = await api.delete(`/words/${id}`);
        return data;
    },

    async getCachedWord(word: string) {
        try {
            const { data } = await api.get(`/words/cache/${encodeURIComponent(word)}`);
            return data;
        } catch {
            return null;
        }
    },

    async cacheWord(word: { word: string; phonetic?: string; translation?: string; definitions?: any[] }) {
        const { data } = await api.post('/words/cache', word);
        return data;
    },

    async importWords(words: any[]) {
        const { data } = await api.post('/words/import', { words });
        return data;
    },

    async getStats(): Promise<{
        totalWords: number;
        withPhonetic: number;
        withTranslation: number;
        withDefinitions: number;
    }> {
        const { data } = await api.get('/words/stats');
        return data;
    },

    async importDictionary(dictionary: string, action: 'import' | 'import-all' = 'import') {
        const { data } = await api.post('/words/import-dictionary', { dictionary, action });
        return data;
    },

    async getDictionaries(): Promise<Array<{
        id: string;
        name: string;
        description: string;
        wordCount: number;
        available: boolean;
    }>> {
        const { data } = await api.get('/words/dictionaries');
        return data;
    }
};

// ============ 授权码 API ============

export const authCodesApi = {
    async getCodes(params?: { codeType?: string; isUsed?: boolean; limit?: number; offset?: number }): Promise<AuthCode[]> {
        const { data } = await api.get('/auth-codes', { params });
        return data;
    },

    async getMyAuthCodes(): Promise<AuthCode[]> {
        const { data } = await api.get('/auth-codes/my');
        return data;
    },

    async generateCodes(codeType: string, count = 1, expiresInDays?: number) {
        const { data } = await api.post('/auth-codes/generate', { codeType, count, expiresInDays });
        return data;
    },

    async redeemCode(code: string) {
        const { data } = await api.post('/auth-codes/redeem', { code });
        return data;
    },

    async deleteCode(id: string) {
        const { data } = await api.delete(`/auth-codes/${id}`);
        return data;
    }
};

// ============ 翻译 API ============

export const translateApi = {
    async translate(text: string, from = 'en', to = 'zh', provider?: string) {
        const { data } = await api.post('/translate', { text, from, to, provider });
        return data;
    },

    async getProviders(): Promise<TranslationProvider[]> {
        const { data } = await api.get('/translate/providers');
        return data;
    },

    async createProvider(provider: Partial<TranslationProvider> & { apiKey: string; apiSecret?: string }) {
        const { data } = await api.post('/translate/providers', provider);
        return data;
    },

    async updateProvider(id: string, updates: Partial<TranslationProvider> & { apiKey?: string; apiSecret?: string }) {
        const { data } = await api.put(`/translate/providers/${id}`, updates);
        return data;
    },

    async deleteProvider(id: string) {
        const { data } = await api.delete(`/translate/providers/${id}`);
        return data;
    },

    async setDefaultProvider(id: string) {
        const { data } = await api.put(`/translate/providers/${id}/default`);
        return data;
    }
};

// ============ 评测 API ============

export const assessmentApi = {
    async getProviders(): Promise<AssessmentProvider[]> {
        const { data } = await api.get('/assessment/providers');
        return data;
    },

    async createProvider(provider: any) {
        const { data } = await api.post('/assessment/providers', provider);
        return data;
    },

    async updateProvider(id: string, updates: any) {
        const { data } = await api.put(`/assessment/providers/${id}`, updates);
        return data;
    },

    async deleteProvider(id: string) {
        const { data } = await api.delete(`/assessment/providers/${id}`);
        return data;
    },

    async setDefaultProvider(id: string) {
        const { data } = await api.put(`/assessment/providers/${id}/default`);
        return data;
    },

    async evaluate(text: string, audioData: string, videoId?: string, providerId?: string) {
        const { data } = await api.post('/assessment/evaluate', { text, audioData, videoId, providerId });
        return data;
    },

    async getHistory(limit = 10, offset = 0) {
        const { data } = await api.get('/assessment/history', { params: { limit, offset } });
        return data;
    }
};

// ============ 管理员 API ============

export const adminApi = {
    async getDashboard() {
        const { data } = await api.get('/api/admin/dashboard');
        return data;
    },

    async resetUserPassword(userId: string, newPassword: string) {
        const { data } = await api.post('/api/admin/reset-password', { userId, newPassword });
        return data;
    },

    async initAdmin(email: string, password: string) {
        const { data } = await api.post('/api/admin/init', { email, password });
        return data;
    },

    async setUserRole(userId: string, role: 'user' | 'admin') {
        const { data } = await api.post('/api/admin/set-role', { userId, role });
        return data;
    },

    async addUserCredits(userId: string, voiceCredits?: number, professionalMinutes?: number) {
        const { data } = await api.post('/api/admin/add-credits', { userId, voiceCredits, professionalMinutes });
        return data;
    },

    async getSystemInfo() {
        const { data } = await api.get('/api/admin/system-info');
        return data;
    }
};

// ============ 设备管理 API ============

export interface DeviceRegistration {
    id: string;
    device_fingerprint: string;
    user_id: string;
    account: string;
    max_registrations: number;
    created_at: string;
    display_name?: string;
    email?: string;
    registrationCount: number;
}

export const devicesApi = {
    async getDevices(params?: { search?: string; limit?: number; offset?: number }): Promise<{ devices: DeviceRegistration[]; total: number }> {
        const { data } = await api.get('/auth/admin/devices', { params });
        return data;
    },

    async unlockDevice(deviceFingerprint: string, action: 'delete' | 'increase-limit', newLimit?: number) {
        const { data } = await api.post('/auth/admin/devices/unlock', { deviceFingerprint, action, newLimit });
        return data;
    },

    async deleteDeviceRegistration(id: string) {
        const { data } = await api.delete(`/auth/admin/devices/${id}`);
        return data;
    }
};

// ============ 工具函数 ============

/**
 * 动态构建文件存储URL
 * 支持从后端静态文件服务获取上传的视频和图片
 */
export const getStorageUrl = (url: string | null | undefined): string => {
    if (!url) return '';

    const apiUrl = getActiveApiUrl();

    // 如果是相对路径，直接拼接 API URL
    if (url.startsWith('/uploads/')) {
        return `${apiUrl}${url}`;
    }

    // 如果是完整 URL，直接返回
    if (url.startsWith('http')) {
        return url;
    }

    // 其他情况，假设是文件名，拼接完整路径
    return `${apiUrl}/uploads/${url}`;
};

/**
 * 解析 SRT 字幕文件
 */
export const parseSRT = (srt: string): Subtitle[] => {
    const normalizedSrt = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalizedSrt.trim().split(/\n\n+/);
    return blocks.map((block, index) => {
        const lines = block.split('\n');
        const timeMatch = lines[1]?.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!timeMatch) return null;

        const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
        const text = lines.slice(2).join(' ');

        return { id: index, start, end, text };
    }).filter(Boolean) as Subtitle[];
};

/**
 * 解析双语 SRT 文件
 */
export const parseBilingualSRT = (srt: string): { en: Subtitle[]; cn: Subtitle[] } => {
    const normalizedSrt = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalizedSrt.trim().split(/\n\n+/);
    const enSubtitles: Subtitle[] = [];
    const cnSubtitles: Subtitle[] = [];

    blocks.forEach((block, index) => {
        const lines = block.split('\n');
        const timeMatch = lines[1]?.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!timeMatch) return;

        const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;

        const textLines = lines.slice(2).filter(line => line.trim().length > 0);
        if (textLines.length === 0) return;

        const containsChinese = (text: string): boolean => /[\u4e00-\u9fa5]/.test(text);

        let enText = '';
        let cnText = '';

        if (textLines.length >= 2) {
            enText = textLines[0].trim();
            cnText = textLines.slice(1).join(' ').trim();
            if (containsChinese(enText) && !containsChinese(cnText)) {
                [enText, cnText] = [cnText, enText];
            }
        } else {
            const singleLine = textLines[0].trim();
            if (containsChinese(singleLine)) {
                cnText = singleLine;
            } else {
                enText = singleLine;
            }
        }

        if (enText) enSubtitles.push({ id: index, start, end, text: enText });
        if (cnText) cnSubtitles.push({ id: index, start, end, text: cnText });
    });

    return { en: enSubtitles, cn: cnSubtitles };
};

// 导出所有 API
export default {
    auth: authApi,
    users: usersApi,
    videos: videosApi,
    categories: categoriesApi,
    learning: learningApi,
    words: wordsApi,
    authCodes: authCodesApi,
    translate: translateApi,
    assessment: assessmentApi,
    admin: adminApi,
    devices: devicesApi
};
