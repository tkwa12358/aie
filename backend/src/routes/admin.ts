import { Router, Request, Response } from 'express';
import { query, queryOne, run, update } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { hashPassword } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /admin/dashboard - 获取仪表盘统计
 */
router.get('/dashboard', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const usersCount = queryOne<any>('SELECT COUNT(*) as count FROM users');
        const videosCount = queryOne<any>('SELECT COUNT(*) as count FROM videos');
        const categoriesCount = queryOne<any>('SELECT COUNT(*) as count FROM video_categories');
        const publishedVideosCount = queryOne<any>('SELECT COUNT(*) as count FROM videos WHERE is_published = 1');
        const codesCount = queryOne<any>('SELECT COUNT(*) as count FROM auth_codes WHERE is_used = 0');
        const assessmentsCount = queryOne<any>('SELECT COUNT(*) as count FROM professional_assessments');
        const todayUsers = queryOne<any>("SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')");
        const todayActive = queryOne<any>("SELECT COUNT(DISTINCT user_id) as count FROM learning_progress WHERE date(updated_at) = date('now')");

        const userGrowth = query<any>(`
      SELECT date(created_at) as date, COUNT(*) as count 
      FROM users 
      WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date
    `);

        res.json({
            totalUsers: usersCount?.count || 0,
            totalVideos: videosCount?.count || 0,
            totalCategories: categoriesCount?.count || 0,
            publishedVideos: publishedVideosCount?.count || 0,
            unusedCodes: codesCount?.count || 0,
            totalAssessments: assessmentsCount?.count || 0,
            todayNewUsers: todayUsers?.count || 0,
            todayActiveUsers: todayActive?.count || 0,
            userGrowth
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: '获取仪表盘数据失败' });
    }
});

/**
 * POST /admin/reset-password - 重置用户密码
 */
router.post('/reset-password', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { userId, newPassword } = req.body;

        if (!userId || !newPassword) {
            return res.status(400).json({ error: '请提供用户ID和新密码' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '密码长度至少6位' });
        }

        const passwordHash = await hashPassword(newPassword);
        const result = update('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

        if (result === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({ message: '密码已重置' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: '重置密码失败' });
    }
});

/**
 * POST /admin/init - 初始化管理员账户
 */
router.post('/init', async (req: Request, res: Response) => {
    try {
        const existingAdmin = queryOne<any>('SELECT id FROM users WHERE role = ?', ['admin']);

        if (existingAdmin) {
            return res.status(400).json({ error: '管理员账户已存在' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '请提供邮箱和密码' });
        }

        const userId = uuidv4();
        const passwordHash = await hashPassword(password);

        run(
            `INSERT INTO users (id, email, password_hash, display_name, role, email_confirmed_at)
       VALUES (?, ?, ?, 'Admin', 'admin', datetime('now'))`,
            [userId, email, passwordHash]
        );

        run('INSERT INTO user_statistics (id, user_id) VALUES (?, ?)', [uuidv4(), userId]);

        res.status(201).json({ message: '管理员账户已创建', userId });
    } catch (error) {
        console.error('Init admin error:', error);
        res.status(500).json({ error: '初始化管理员失败' });
    }
});

/**
 * POST /admin/set-role - 设置用户角色
 */
router.post('/set-role', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { userId, role } = req.body;

        if (!userId || !role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: '请提供有效的用户ID和角色' });
        }

        if (userId === req.user?.userId) {
            return res.status(400).json({ error: '不能修改自己的角色' });
        }

        const result = update('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

        if (result === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({ message: '角色已更新' });
    } catch (error) {
        console.error('Set role error:', error);
        res.status(500).json({ error: '设置角色失败' });
    }
});

/**
 * POST /admin/add-credits - 为用户添加额度
 */
router.post('/add-credits', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const { userId, voiceCredits, professionalMinutes } = req.body;

        if (!userId) {
            return res.status(400).json({ error: '请提供用户ID' });
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (voiceCredits) { updates.push('voice_credits = voice_credits + ?'); params.push(voiceCredits); }
        if (professionalMinutes) { updates.push('professional_voice_minutes = professional_voice_minutes + ?'); params.push(professionalMinutes); }

        if (updates.length === 0) {
            return res.status(400).json({ error: '请提供要添加的额度' });
        }

        params.push(userId);
        const result = update(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        if (result === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const user = queryOne<any>('SELECT voice_credits, professional_voice_minutes FROM users WHERE id = ?', [userId]);

        res.json({
            message: '额度已添加',
            voiceCredits: user?.voice_credits,
            professionalMinutes: user?.professional_voice_minutes
        });
    } catch (error) {
        console.error('Add credits error:', error);
        res.status(500).json({ error: '添加额度失败' });
    }
});

/**
 * GET /admin/system-info - 获取系统信息
 */
router.get('/system-info', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        res.json({
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            env: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        console.error('Get system info error:', error);
        res.status(500).json({ error: '获取系统信息失败' });
    }
});

export default router;
