import axios, { AxiosInstance, AxiosError } from 'axios';

// API 基础 URL
function getApiBaseUrl(): string {
    const envUrl = import.meta.env.VITE_API_URL;

    // 如果明确设置了 VITE_API_URL 且不是 'auto'，直接使用
    // 注意：'/' 表示同源请求，不需要添加 /api 前缀
    if (envUrl && envUrl !== 'auto') {
        // 如果是 '/'，返回空字符串表示相对路径
        return envUrl === '/' ? '' : envUrl;
    }

    // 自动检测：使用当前访问的主机地址
    const host = window.location.hostname;
    const isLocalDev = host === 'localhost' || host === '127.0.0.1' ||
        /^192\.168\./.test(host) || /^172\.\d+\./.test(host) || /^10\./.test(host);

    if (isLocalDev) {
        // 本地开发：如果后端在相同端口（单容器部署），使用空字符串
        // 如果后端在不同端口，使用后端端口
        const port = window.location.port;
        if (port === '3000') {
            // 单容器部署，前后端同一端口
            return '';
        }
        return `http://${host}:3000`;
    }

    // 生产环境：使用同一域名，不需要 /api 前缀（后端已是同源）
    return '';
}

// 创建 axios 实例
const api: AxiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 请求拦截器：自动附加 token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器：处理 401 自动登出
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            // 避免在登录页面重复跳转
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// 获取当前 API 基础 URL
export const getActiveApiUrl = () => getApiBaseUrl();

export { api };
export default api;
