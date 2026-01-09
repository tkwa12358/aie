import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 加载环境变量
dotenv.config();

// 导入数据库并初始化
import { initDatabase, testConnection } from './config/database';

// 导入中间件
import { errorHandler, notFoundHandler } from './middleware/error-handler';

// 导入路由
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import videosRoutes from './routes/videos';
import categoriesRoutes from './routes/categories';
import learningRoutes from './routes/learning';
import wordsRoutes from './routes/words';
import authCodesRoutes from './routes/auth-codes';
import translateRoutes from './routes/translate';
import assessmentRoutes from './routes/assessment';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 配置
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析 JSON 请求体 (增大限制以支持音频数据)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务 - 上传的视频等
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.resolve(uploadDir)));

// 静态文件服务 - 前端文件
const frontendDir = process.env.FRONTEND_DIR || './public';
if (fs.existsSync(frontendDir)) {
    app.use(express.static(path.resolve(frontendDir)));
}

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由 - 所有 API 使用 /api 前缀
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/words', wordsRoutes);
app.use('/api/auth-codes', authCodesRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/admin', adminRoutes);

// 兼容旧路由（不带 /api 前缀）- 仅保留不与前端路由冲突的
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/videos', videosRoutes);
app.use('/categories', categoriesRoutes);
app.use('/learning', learningRoutes);
app.use('/words', wordsRoutes);
app.use('/auth-codes', authCodesRoutes);
app.use('/translate', translateRoutes);
app.use('/assessment', assessmentRoutes);
// 注意: /admin 路由不再注册，因为与前端 SPA 路由冲突

// SPA 路由 - 所有非 API 请求返回 index.html
app.get('*', (req, res, next) => {
    // 如果是 API 请求，交给 404 处理
    if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/uploads')) {
        return next();
    }

    const indexPath = path.resolve(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        next();
    }
});

// 404 处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// 启动服务器
async function startServer() {
    // 初始化数据库 (async)
    try {
        await initDatabase();
        console.log('✅ Database ready');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    }

    // 测试数据库连接
    if (!testConnection()) {
        console.error('❌ Cannot start server without database connection');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════╗
║     AI English Studio                          ║
╠════════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}               ║
║  📁 Upload directory: ${uploadDir}               ║
║  🌍 Environment: ${process.env.NODE_ENV || 'development'}              ║
║  💾 Database: SQLite                           ║
╚════════════════════════════════════════════════╝
    `);
    });
}

startServer();

export default app;
