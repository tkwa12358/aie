import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// 文件上传配置
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(uploadDir, 'videos');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '500000000') },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的视频格式'));
        }
    }
});

interface Video {
    id: string;
    category_id: string | null;
    title: string;
    description: string | null;
    video_url: string;
    thumbnail_url: string | null;
    duration: number | null;
    subtitles_en: string | null;
    subtitles_cn: string | null;
    is_published: number;
    view_count: number;
    created_at: string;
    updated_at: string;
}

/**
 * GET /videos - 获取视频列表
 */
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const { categoryId, published, limit = '50', offset = '0' } = req.query;
        const isAdmin = req.user?.role === 'admin';

        let sql = `
      SELECT v.*, c.name as category_name 
      FROM videos v 
      LEFT JOIN video_categories c ON v.category_id = c.id
      WHERE 1=1
    `;
        const params: any[] = [];

        if (!isAdmin) {
            sql += ' AND v.is_published = 1';
        } else if (published !== undefined) {
            sql += ' AND v.is_published = ?';
            params.push(published === 'true' ? 1 : 0);
        }

        if (categoryId) {
            sql += ' AND v.category_id = ?';
            params.push(categoryId);
        }

        sql += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit as string), parseInt(offset as string));

        const videos = query<Video>(sql, params);
        res.json(videos);
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ error: '获取视频列表失败' });
    }
});

/**
 * GET /videos/:id - 获取视频详情
 */
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';

        let sql = `
      SELECT v.*, c.name as category_name 
      FROM videos v 
      LEFT JOIN video_categories c ON v.category_id = c.id
      WHERE v.id = ?
    `;

        if (!isAdmin) {
            sql += ' AND v.is_published = 1';
        }

        const video = queryOne<Video>(sql, [id]);

        if (!video) {
            return res.status(404).json({ error: '视频不存在' });
        }

        // 增加观看次数
        update('UPDATE videos SET view_count = view_count + 1 WHERE id = ?', [id]);

        res.json(video);
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ error: '获取视频详情失败' });
    }
});

/**
 * POST /videos - 创建视频 (管理员)
 */
router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { categoryId, title, description, videoUrl, thumbnailUrl, duration, subtitlesEn, subtitlesCn, isPublished } = req.body;

        if (!title || !videoUrl) {
            return res.status(400).json({ error: '请提供视频标题和URL' });
        }

        const id = uuidv4();
        run(
            `INSERT INTO videos (id, category_id, title, description, video_url, thumbnail_url, duration, subtitles_en, subtitles_cn, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, categoryId || null, title, description || null, videoUrl, thumbnailUrl || null, duration || null, subtitlesEn || null, subtitlesCn || null, isPublished ? 1 : 0]
        );

        const video = queryOne<Video>('SELECT * FROM videos WHERE id = ?', [id]);
        res.status(201).json(video);
    } catch (error) {
        console.error('Create video error:', error);
        res.status(500).json({ error: '创建视频失败' });
    }
});

/**
 * PUT /videos/:id - 更新视频 (管理员)
 */
router.put('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { categoryId, title, description, videoUrl, thumbnailUrl, duration, subtitlesEn, subtitlesCn, isPublished } = req.body;

        const updates: string[] = [];
        const params: any[] = [];

        if (categoryId !== undefined) { updates.push('category_id = ?'); params.push(categoryId || null); }
        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (videoUrl !== undefined) { updates.push('video_url = ?'); params.push(videoUrl); }
        if (thumbnailUrl !== undefined) { updates.push('thumbnail_url = ?'); params.push(thumbnailUrl); }
        if (duration !== undefined) { updates.push('duration = ?'); params.push(duration); }
        if (subtitlesEn !== undefined) { updates.push('subtitles_en = ?'); params.push(subtitlesEn); }
        if (subtitlesCn !== undefined) { updates.push('subtitles_cn = ?'); params.push(subtitlesCn); }
        if (isPublished !== undefined) { updates.push('is_published = ?'); params.push(isPublished ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }

        updates.push("updated_at = datetime('now')");
        params.push(id);
        const result = update(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`, params);

        if (result === 0) {
            return res.status(404).json({ error: '视频不存在' });
        }

        const video = queryOne<Video>('SELECT * FROM videos WHERE id = ?', [id]);
        res.json(video);
    } catch (error) {
        console.error('Update video error:', error);
        res.status(500).json({ error: '更新视频失败' });
    }
});

/**
 * DELETE /videos/:id - 删除视频 (管理员)
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = update('DELETE FROM videos WHERE id = ?', [id]);

        if (result === 0) {
            return res.status(404).json({ error: '视频不存在' });
        }

        res.json({ message: '视频已删除' });
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({ error: '删除视频失败' });
    }
});

/**
 * POST /videos/:id/upload - 上传视频文件 (管理员)
 */
router.post('/:id/upload', authMiddleware, adminMiddleware, upload.single('file'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: '请选择视频文件' });
        }

        const videoUrl = `/uploads/videos/${file.filename}`;
        update('UPDATE videos SET video_url = ? WHERE id = ?', [videoUrl, id]);

        res.json({ videoUrl, message: '视频上传成功' });
    } catch (error) {
        console.error('Upload video error:', error);
        res.status(500).json({ error: '视频上传失败' });
    }
});

/**
 * POST /videos/upload - 上传视频文件（独立上传）
 */
router.post('/upload', authMiddleware, adminMiddleware, upload.single('file'), async (req: Request, res: Response) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: '请选择视频文件' });
        }

        const videoUrl = `/uploads/videos/${file.filename}`;
        res.json({ videoUrl, filename: file.filename, message: '视频上传成功' });
    } catch (error) {
        console.error('Upload video error:', error);
        res.status(500).json({ error: '视频上传失败' });
    }
});

// 缩略图上传配置
const thumbnailStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(uploadDir, 'thumbnails');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `thumb-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
    }
});

const thumbnailUpload = multer({
    storage: thumbnailStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的图片格式'));
        }
    }
});

/**
 * POST /videos/upload-thumbnail - 上传缩略图
 */
router.post('/upload-thumbnail', authMiddleware, adminMiddleware, thumbnailUpload.single('file'), async (req: Request, res: Response) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: '请选择图片文件' });
        }

        const thumbnailUrl = `/uploads/thumbnails/${file.filename}`;
        res.json({ thumbnailUrl, filename: file.filename, message: '缩略图上传成功' });
    } catch (error) {
        console.error('Upload thumbnail error:', error);
        res.status(500).json({ error: '缩略图上传失败' });
    }
});

export default router;

